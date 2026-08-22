"""
Turns the structured reconciliation result into a short plain-English
narrative. This is template-based text generation over numbers we already
computed - not a call out to an LLM - so the wording is fast, free, and
traceable back to the exact figures it describes.
"""
from __future__ import annotations

from .reconciliation import ReconciliationResult


def _money(v: float) -> str:
    sign = "-" if v < 0 else ""
    return f"{sign}${abs(v):,.2f}"


def generate_summary(result: ReconciliationResult) -> str:
    lines: list[str] = []

    lines.append(
        f"I compared {result.vendor_count} vendor statement transactions against "
        f"{result.ledger_count} ledger transactions. "
        f"{result.exact_match_count} matched exactly on reference and amount"
        + (
            f", and {result.probable_match_count} more were matched on amount, date, and description "
            f"where no reliable reference was available."
            if result.probable_match_count
            else "."
        )
    )

    if result.mismatch_count:
        lines.append(
            f"{result.mismatch_count} transaction(s) share the same reference on both sides but "
            f"disagree on amount, a net difference of {_money(sum(m['difference'] for m in result.mismatches))}."
        )

    if result.unmatched_vendor_count:
        vendor_sum = sum(d["amount"] or 0 for d in result.discrepancies if d["type"] == "unmatched_vendor")
        lines.append(
            f"{result.unmatched_vendor_count} transaction(s) totalling {_money(vendor_sum)} appear on the "
            f"vendor statement only - the ledger has no matching entry."
        )

    if result.unmatched_ledger_count:
        ledger_sum = sum(d["amount"] or 0 for d in result.discrepancies if d["type"] == "unmatched_ledger")
        lines.append(
            f"{result.unmatched_ledger_count} transaction(s) totalling {_money(ledger_sum)} appear in the "
            f"ledger only - the vendor statement has no matching entry."
        )

    if not (result.mismatch_count or result.unmatched_vendor_count or result.unmatched_ledger_count):
        lines.append("Every transaction on both sides was matched with no amount disagreements.")

    check = result.reconciliation_check
    lines.append(
        f"Vendor statement total: {_money(result.vendor_total)}. Ledger total: {_money(result.ledger_total)}. "
        f"Difference: {_money(check['statement_minus_ledger'])}."
    )

    if check["is_fully_explained"]:
        if abs(check["statement_minus_ledger"]) <= 0.01:
            lines.append("The two sources are fully reconciled - no residual difference.")
        else:
            lines.append(
                "That entire difference is accounted for by the discrepancies above, so the books tie out "
                "once those items are resolved."
            )
    else:
        lines.append(
            f"After accounting for the discrepancies above, {_money(check['unexplained_residual'])} of the "
            f"difference is still unexplained and worth a closer look - it may indicate a discrepancy the "
            f"matching rules didn't catch (e.g. a split transaction or a data entry error in date/amount)."
        )

    high = sum(1 for d in result.discrepancies if d["priority"] == "high")
    medium = sum(1 for d in result.discrepancies if d["priority"] == "medium")
    if high or medium:
        lines.append(
            f"Priority: {high} high-priority item(s) and {medium} medium-priority item(s) are worth reviewing first "
            f"(see the discrepancy list, sorted by priority then value)."
        )

    return " ".join(lines)
