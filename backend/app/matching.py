"""
Matching engine.

This is deliberately a plain, deterministic, rule-based pipeline - NOT an LLM
call - so every match can be explained by pointing at the exact rule and
inputs that produced it. Each stage is a small, testable function; the
orchestrator runs them in priority order and removes matched items from the
pool before the next stage runs.

Stages (in order of confidence):
  1. exact_reference_amount  - same normalized reference, same amount (+/- tolerance)
  2. reference_amount_mismatch - same normalized reference, DIFFERENT amount
     -> this is not a "match" so much as a flagged pairing; both sides are
        surfaced together as an amount-mismatch discrepancy.
  3. amount_date_description - no usable reference on one/both sides; fall
     back to amount match within a date window, disambiguated by description
     text similarity when more than one candidate exists.
  4. anything left over -> unmatched on its respective side.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta
from difflib import SequenceMatcher
from typing import Optional

from .normalize import NormalizedTransaction

DEFAULT_AMOUNT_TOLERANCE = 0.01
DEFAULT_DATE_WINDOW_DAYS = 3
PROBABLE_MATCH_MIN_SCORE = 0.55  # below this, we don't even offer it as a probable match


@dataclass
class MatchResult:
    match_type: str  # "exact_reference_amount" | "probable_match"
    vendor_txn: NormalizedTransaction
    ledger_txn: NormalizedTransaction
    confidence: float  # 0..1
    reasoning: str


@dataclass
class MismatchResult:
    """Same reference on both sides, but the amounts disagree."""
    vendor_txn: NormalizedTransaction
    ledger_txn: NormalizedTransaction
    difference: float  # vendor.amount - ledger.amount
    reasoning: str


def _amounts_close(a: Optional[float], b: Optional[float], tolerance: float) -> bool:
    if a is None or b is None:
        return False
    return abs(a - b) <= tolerance


def _description_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


def _stage1_and_2_reference_matching(
    vendor_pool: list[NormalizedTransaction],
    ledger_pool: list[NormalizedTransaction],
    amount_tolerance: float,
) -> tuple[list[MatchResult], list[MismatchResult], list[NormalizedTransaction], list[NormalizedTransaction]]:
    """Group remaining transactions by normalized reference and pair them off.

    Returns (matches, mismatches, remaining_vendor, remaining_ledger).
    """
    matches: list[MatchResult] = []
    mismatches: list[MismatchResult] = []

    vendor_by_ref: dict[str, list[NormalizedTransaction]] = {}
    for t in vendor_pool:
        if t.reference_key:
            vendor_by_ref.setdefault(t.reference_key, []).append(t)

    matched_vendor_ids: set[str] = set()
    matched_ledger_ids: set[str] = set()

    for t in ledger_pool:
        if not t.reference_key:
            continue
        candidates = vendor_by_ref.get(t.reference_key, [])
        candidates = [c for c in candidates if c.id not in matched_vendor_ids]
        if not candidates:
            continue
        # If multiple candidates share a reference, pick the closest amount match.
        candidates.sort(key=lambda c: abs((c.amount or 0) - (t.amount or 0)))
        best = candidates[0]

        if _amounts_close(best.amount, t.amount, amount_tolerance):
            matches.append(
                MatchResult(
                    match_type="exact_reference_amount",
                    vendor_txn=best,
                    ledger_txn=t,
                    confidence=1.0,
                    reasoning=(
                        f"Reference '{best.reference}' matches on both sides and the "
                        f"amounts agree ({best.amount:.2f})."
                    ),
                )
            )
        else:
            mismatches.append(
                MismatchResult(
                    vendor_txn=best,
                    ledger_txn=t,
                    difference=round((best.amount or 0) - (t.amount or 0), 2),
                    reasoning=(
                        f"Reference '{best.reference}' appears on both sides but the amounts "
                        f"differ: vendor statement shows {best.amount:.2f}, ledger shows {t.amount:.2f}."
                    ),
                )
            )
        matched_vendor_ids.add(best.id)
        matched_ledger_ids.add(t.id)

    remaining_vendor = [t for t in vendor_pool if t.id not in matched_vendor_ids]
    remaining_ledger = [t for t in ledger_pool if t.id not in matched_ledger_ids]
    return matches, mismatches, remaining_vendor, remaining_ledger


def _stage3_amount_date_description(
    vendor_pool: list[NormalizedTransaction],
    ledger_pool: list[NormalizedTransaction],
    amount_tolerance: float,
    date_window_days: int,
) -> tuple[list[MatchResult], list[NormalizedTransaction], list[NormalizedTransaction]]:
    """For transactions with no usable reference match, fall back to
    amount + date-proximity, using description similarity to break ties.
    Greedy best-score-first assignment so the strongest evidence wins first.
    """
    candidate_pairs: list[tuple[float, NormalizedTransaction, NormalizedTransaction, int, float]] = []

    for v in vendor_pool:
        if v.amount is None or v.date is None:
            continue
        for l in ledger_pool:
            if l.amount is None or l.date is None:
                continue
            if not _amounts_close(v.amount, l.amount, amount_tolerance):
                continue
            date_diff = abs((v.date - l.date).days)
            if date_diff > date_window_days:
                continue
            desc_sim = _description_similarity(v.description, l.description)
            # Score: date closeness dominates, description similarity breaks ties.
            date_score = 1 - (date_diff / (date_window_days + 1))
            score = 0.7 * date_score + 0.3 * desc_sim
            if score < PROBABLE_MATCH_MIN_SCORE:
                continue
            candidate_pairs.append((score, v, l, date_diff, desc_sim))

    candidate_pairs.sort(key=lambda p: p[0], reverse=True)

    matched_vendor_ids: set[str] = set()
    matched_ledger_ids: set[str] = set()
    matches: list[MatchResult] = []

    for score, v, l, date_diff, desc_sim in candidate_pairs:
        if v.id in matched_vendor_ids or l.id in matched_ledger_ids:
            continue
        matches.append(
            MatchResult(
                match_type="probable_match",
                vendor_txn=v,
                ledger_txn=l,
                confidence=round(score, 2),
                reasoning=(
                    f"No reliable reference on one/both sides; matched on amount "
                    f"({v.amount:.2f}) with a {date_diff}-day date gap and "
                    f"{desc_sim*100:.0f}% description similarity."
                ),
            )
        )
        matched_vendor_ids.add(v.id)
        matched_ledger_ids.add(l.id)

    remaining_vendor = [t for t in vendor_pool if t.id not in matched_vendor_ids]
    remaining_ledger = [t for t in ledger_pool if t.id not in matched_ledger_ids]
    return matches, remaining_vendor, remaining_ledger


@dataclass
class MatchingOutput:
    matches: list[MatchResult]
    mismatches: list[MismatchResult]
    unmatched_vendor: list[NormalizedTransaction]
    unmatched_ledger: list[NormalizedTransaction]


def run_matching(
    vendor_txns: list[NormalizedTransaction],
    ledger_txns: list[NormalizedTransaction],
    amount_tolerance: float = DEFAULT_AMOUNT_TOLERANCE,
    date_window_days: int = DEFAULT_DATE_WINDOW_DAYS,
) -> MatchingOutput:
    stage_1_2_matches, mismatches, rem_vendor, rem_ledger = _stage1_and_2_reference_matching(
        vendor_txns, ledger_txns, amount_tolerance
    )
    stage_3_matches, rem_vendor, rem_ledger = _stage3_amount_date_description(
        rem_vendor, rem_ledger, amount_tolerance, date_window_days
    )

    all_matches = stage_1_2_matches + stage_3_matches
    return MatchingOutput(
        matches=all_matches,
        mismatches=mismatches,
        unmatched_vendor=rem_vendor,
        unmatched_ledger=rem_ledger,
    )
