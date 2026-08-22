"""
Turns matching output into the numbers a human actually needs:
running balances per source, a prioritized discrepancy list, and a
reconciliation check that proves the statement-vs-ledger difference is fully
explained by the discrepancies found (or tells you how much is still
unexplained).
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .matching import MatchingOutput, MatchResult, MismatchResult
from .normalize import NormalizedTransaction

HIGH_VALUE_THRESHOLD = 1000.0
MEDIUM_VALUE_THRESHOLD = 100.0
LOW_CONFIDENCE_THRESHOLD = 0.75


def _running_balance(txns: list[NormalizedTransaction], opening_balance: float) -> list[dict]:
    ordered = sorted(
        txns,
        key=lambda t: (t.date is None, t.date, t.row_number),
    )
    balance = opening_balance
    out = []
    for t in ordered:
        amt = t.amount or 0.0
        balance = round(balance + amt, 2)
        out.append(
            {
                "id": t.id,
                "date": t.date.isoformat() if t.date else None,
                "reference": t.reference,
                "description": t.description,
                "amount": t.amount,
                "running_balance": balance,
            }
        )
    return out


def _priority_for_unmatched(txn: NormalizedTransaction) -> str:
    amount = abs(txn.amount or 0.0)
    if amount >= HIGH_VALUE_THRESHOLD:
        return "high"
    if amount >= MEDIUM_VALUE_THRESHOLD:
        return "medium"
    return "low"


def _priority_for_mismatch(mismatch: MismatchResult) -> str:
    # A same-reference amount mismatch is inherently suspicious (possible
    # duplicate payment, short payment, or data entry error) regardless of
    # size, so it starts at medium and escalates with value.
    if abs(mismatch.difference) >= HIGH_VALUE_THRESHOLD:
        return "high"
    if abs(mismatch.difference) >= 1.0:
        return "medium"
    return "low"


def _priority_for_probable_match(match: MatchResult) -> Optional[str]:
    """Probable (fuzzy) matches with low confidence are worth a human glance
    even though the engine paired them up automatically."""
    if match.match_type != "probable_match":
        return None
    if match.confidence < LOW_CONFIDENCE_THRESHOLD:
        return "medium"
    return "low"


@dataclass
class ReconciliationResult:
    vendor_total: float
    ledger_total: float
    difference: float
    vendor_count: int
    ledger_count: int
    matched_count: int
    exact_match_count: int
    probable_match_count: int
    mismatch_count: int
    unmatched_vendor_count: int
    unmatched_ledger_count: int
    matches: list[dict]
    mismatches: list[dict]
    discrepancies: list[dict]
    running_balance_vendor: list[dict]
    running_balance_ledger: list[dict]
    reconciliation_check: dict


def build_reconciliation(
    vendor_txns: list[NormalizedTransaction],
    ledger_txns: list[NormalizedTransaction],
    matching: MatchingOutput,
    vendor_opening_balance: float = 0.0,
    ledger_opening_balance: float = 0.0,
) -> ReconciliationResult:
    vendor_total = round(sum(t.amount or 0.0 for t in vendor_txns), 2)
    ledger_total = round(sum(t.amount or 0.0 for t in ledger_txns), 2)
    difference = round(vendor_total - ledger_total, 2)

    # ---- discrepancy list (unmatched + mismatched + low-confidence matches) ----
    discrepancies: list[dict] = []

    for t in matching.unmatched_vendor:
        discrepancies.append(
            {
                "type": "unmatched_vendor",
                "priority": _priority_for_unmatched(t),
                "amount": t.amount,
                "date": t.date.isoformat() if t.date else None,
                "reference": t.reference,
                "description": t.description,
                "vendor_txn": t.to_dict(),
                "ledger_txn": None,
                "reasoning": "Appears in the vendor statement but has no corresponding entry in the ledger.",
            }
        )

    for t in matching.unmatched_ledger:
        discrepancies.append(
            {
                "type": "unmatched_ledger",
                "priority": _priority_for_unmatched(t),
                "amount": t.amount,
                "date": t.date.isoformat() if t.date else None,
                "reference": t.reference,
                "description": t.description,
                "vendor_txn": None,
                "ledger_txn": t.to_dict(),
                "reasoning": "Appears in the ledger but has no corresponding entry in the vendor statement.",
            }
        )

    for m in matching.mismatches:
        discrepancies.append(
            {
                "type": "amount_mismatch",
                "priority": _priority_for_mismatch(m),
                "amount": m.difference,
                "date": m.vendor_txn.date.isoformat() if m.vendor_txn.date else None,
                "reference": m.vendor_txn.reference,
                "description": m.vendor_txn.description,
                "vendor_txn": m.vendor_txn.to_dict(),
                "ledger_txn": m.ledger_txn.to_dict(),
                "reasoning": m.reasoning,
            }
        )

    for match in matching.matches:
        p = _priority_for_probable_match(match)
        if p:
            discrepancies.append(
                {
                    "type": "low_confidence_match",
                    "priority": p,
                    "amount": match.vendor_txn.amount,
                    "date": match.vendor_txn.date.isoformat() if match.vendor_txn.date else None,
                    "reference": match.vendor_txn.reference,
                    "description": match.vendor_txn.description,
                    "vendor_txn": match.vendor_txn.to_dict(),
                    "ledger_txn": match.ledger_txn.to_dict(),
                    "reasoning": (
                        f"Matched automatically at {match.confidence*100:.0f}% confidence - "
                        f"worth a quick human check. {match.reasoning}"
                    ),
                }
            )

    priority_rank = {"high": 0, "medium": 1, "low": 2}
    discrepancies.sort(key=lambda d: (priority_rank[d["priority"]], -abs(d["amount"] or 0)))

    # ---- reconciliation check: does the difference fully explain itself? ----
    unmatched_vendor_sum = round(sum(t.amount or 0.0 for t in matching.unmatched_vendor), 2)
    unmatched_ledger_sum = round(sum(t.amount or 0.0 for t in matching.unmatched_ledger), 2)
    mismatch_sum = round(sum(m.difference for m in matching.mismatches), 2)
    explained_difference = round(unmatched_vendor_sum - unmatched_ledger_sum + mismatch_sum, 2)
    unexplained = round(difference - explained_difference, 2)

    reconciliation_check = {
        "statement_minus_ledger": difference,
        "explained_by_unmatched_vendor_items": unmatched_vendor_sum,
        "explained_by_unmatched_ledger_items": -unmatched_ledger_sum,
        "explained_by_amount_mismatches": mismatch_sum,
        "total_explained": explained_difference,
        "unexplained_residual": unexplained,
        "is_fully_explained": abs(unexplained) <= 0.01,
    }

    exact_matches = [m for m in matching.matches if m.match_type == "exact_reference_amount"]
    probable_matches = [m for m in matching.matches if m.match_type == "probable_match"]

    return ReconciliationResult(
        vendor_total=vendor_total,
        ledger_total=ledger_total,
        difference=difference,
        vendor_count=len(vendor_txns),
        ledger_count=len(ledger_txns),
        matched_count=len(matching.matches),
        exact_match_count=len(exact_matches),
        probable_match_count=len(probable_matches),
        mismatch_count=len(matching.mismatches),
        unmatched_vendor_count=len(matching.unmatched_vendor),
        unmatched_ledger_count=len(matching.unmatched_ledger),
        matches=[
            {
                "match_type": m.match_type,
                "confidence": m.confidence,
                "reasoning": m.reasoning,
                "vendor_txn": m.vendor_txn.to_dict(),
                "ledger_txn": m.ledger_txn.to_dict(),
            }
            for m in matching.matches
        ],
        mismatches=[
            {
                "difference": m.difference,
                "reasoning": m.reasoning,
                "vendor_txn": m.vendor_txn.to_dict(),
                "ledger_txn": m.ledger_txn.to_dict(),
            }
            for m in matching.mismatches
        ],
        discrepancies=discrepancies,
        running_balance_vendor=_running_balance(vendor_txns, vendor_opening_balance),
        running_balance_ledger=_running_balance(ledger_txns, ledger_opening_balance),
        reconciliation_check=reconciliation_check,
    )
