"""
Normalization layer.

Takes raw CSV bytes from either the vendor statement or the internal ledger
and converts them into a common, predictable schema (NormalizedTransaction)
regardless of how the source spreadsheet happened to name its columns.

Everything here is plain, deterministic Python - no ML/LLM involved - so the
mapping from "raw column" -> "normalized field" can be inspected and unit
tested like any other code.
"""
from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date
from typing import Optional

from dateutil import parser as dateparser


# ---------------------------------------------------------------------------
# Column header synonyms. Real-world exports rarely agree on naming, so we
# match a header against several likely variants (case/space/punctuation
# insensitive).
# ---------------------------------------------------------------------------
HEADER_SYNONYMS: dict[str, list[str]] = {
    "date": ["date", "transactiondate", "txndate", "postingdate", "postdate", "value date", "valuedate"],
    "reference": [
        "reference", "ref", "refno", "refnumber", "invoiceno", "invoicenumber",
        "invoice", "checkno", "chequeno", "docnumber", "documentnumber",
        "transactionid", "txnid", "id",
    ],
    "description": ["description", "details", "narrative", "memo", "particulars", "narration"],
    "debit": ["debit", "debitamount", "dr", "withdrawal", "charges", "charge"],
    "credit": ["credit", "creditamount", "cr", "deposit", "payment", "payments"],
    "amount": ["amount", "amt", "value", "transactionamount", "txnamount"],
    "balance": ["balance", "runningbalance", "closingbalance"],
}


def _canonical(header: str) -> str:
    """Lower-case and strip everything but letters/digits, e.g. 'Ref. No.' -> 'refno'."""
    return re.sub(r"[^a-z0-9]", "", header.lower())


def _build_header_map(fieldnames: list[str]) -> dict[str, str]:
    """Map canonical field name -> actual CSV column name present in the file."""
    canon_lookup = {_canonical(fn): fn for fn in fieldnames if fn}
    mapping: dict[str, str] = {}
    for canonical_field, synonyms in HEADER_SYNONYMS.items():
        for syn in synonyms:
            if syn in canon_lookup:
                mapping[canonical_field] = canon_lookup[syn]
                break
    return mapping


_CURRENCY_CHARS = re.compile(r"[^0-9.\-()]")


def parse_amount(raw: Optional[str]) -> Optional[float]:
    """Parse a currency-ish string ("$1,234.50", "(1,234.50)", "1234.5") into a float.

    Parenthesised values are treated as negative, matching common accounting
    export conventions.
    """
    if raw is None:
        return None
    text = raw.strip()
    if text == "":
        return None
    negative = text.startswith("(") and text.endswith(")")
    cleaned = _CURRENCY_CHARS.sub("", text)
    cleaned = cleaned.replace("(", "").replace(")", "")
    if cleaned in ("", "-", "."):
        return None
    try:
        value = float(cleaned)
    except ValueError:
        return None
    return -abs(value) if negative else value


def parse_date_flexible(raw: Optional[str]) -> Optional[date]:
    if raw is None:
        return None
    text = raw.strip()
    if text == "":
        return None
    try:
        return dateparser.parse(text, dayfirst=False, fuzzy=True).date()
    except (ValueError, OverflowError):
        try:
            return dateparser.parse(text, dayfirst=True, fuzzy=True).date()
        except (ValueError, OverflowError):
            return None


def normalize_reference(raw: Optional[str]) -> Optional[str]:
    """Key used for *matching* references: strips punctuation/whitespace, upper-cases,
    and strips leading zeros so '00123', '#123', ' 123 ' all match."""
    if not raw:
        return None
    stripped = re.sub(r"[^A-Za-z0-9]", "", raw).upper()
    stripped = stripped.lstrip("0")
    return stripped or None


@dataclass
class NormalizedTransaction:
    id: str
    source: str  # "vendor" | "ledger"
    row_number: int  # 1-based position in the original file (for traceability)
    date: Optional[date]
    date_raw: Optional[str]
    reference: Optional[str]  # original, human-readable
    reference_key: Optional[str]  # normalized key used for matching
    description: str
    amount: Optional[float]  # signed: positive = charge/increase, negative = payment/credit
    balance_hint: Optional[float]  # balance column from the source file, if present
    raw: dict = field(default_factory=dict)  # original row, untouched

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "source": self.source,
            "row_number": self.row_number,
            "date": self.date.isoformat() if self.date else None,
            "date_raw": self.date_raw,
            "reference": self.reference,
            "description": self.description,
            "amount": self.amount,
            "balance_hint": self.balance_hint,
        }


class NormalizationError(Exception):
    pass


def normalize_csv(raw_bytes: bytes, source: str, id_prefix: str) -> tuple[list[NormalizedTransaction], dict]:
    """Parse raw CSV bytes into a list of NormalizedTransaction.

    Returns (transactions, meta) where meta describes which columns were
    detected, so the frontend/user can see exactly how the file was
    interpreted.
    """
    text = raw_bytes.decode("utf-8-sig", errors="replace")
    reader = csv.DictReader(io.StringIO(text))
    if not reader.fieldnames:
        raise NormalizationError(f"Could not find a header row in the {source} file.")

    header_map = _build_header_map(reader.fieldnames)
    if "date" not in header_map:
        raise NormalizationError(
            f"Could not find a date column in the {source} file. "
            f"Columns seen: {', '.join(reader.fieldnames)}"
        )
    if "amount" not in header_map and not ({"debit", "credit"} & header_map.keys()):
        raise NormalizationError(
            f"Could not find an amount (or debit/credit) column in the {source} file. "
            f"Columns seen: {', '.join(reader.fieldnames)}"
        )

    transactions: list[NormalizedTransaction] = []
    for idx, row in enumerate(reader, start=1):
        date_raw = row.get(header_map.get("date", ""), "")
        parsed_date = parse_date_flexible(date_raw)

        if "debit" in header_map or "credit" in header_map:
            debit = parse_amount(row.get(header_map.get("debit", ""), "")) or 0.0
            credit = parse_amount(row.get(header_map.get("credit", ""), "")) or 0.0
            amount = credit - debit
        else:
            amount = parse_amount(row.get(header_map.get("amount", ""), ""))

        reference_raw = row.get(header_map.get("reference", ""), "") if "reference" in header_map else ""
        reference_raw = reference_raw.strip() if reference_raw else None

        description = row.get(header_map.get("description", ""), "") if "description" in header_map else ""
        description = (description or "").strip()

        balance_hint = None
        if "balance" in header_map:
            balance_hint = parse_amount(row.get(header_map["balance"], ""))

        # Skip fully blank rows (common trailing rows in exported CSVs)
        if not any(v.strip() for v in row.values() if isinstance(v, str)):
            continue

        transactions.append(
            NormalizedTransaction(
                id=f"{id_prefix}-{idx:04d}",
                source=source,
                row_number=idx,
                date=parsed_date,
                date_raw=date_raw,
                reference=reference_raw,
                reference_key=normalize_reference(reference_raw),
                description=description,
                amount=amount,
                balance_hint=balance_hint,
                raw=row,
            )
        )

    meta = {
        "detected_columns": header_map,
        "row_count": len(transactions),
        "source_columns": reader.fieldnames,
    }
    return transactions, meta
