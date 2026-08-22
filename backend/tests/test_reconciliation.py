from pathlib import Path

from fastapi.testclient import TestClient

from app.main import app
from app.normalize import normalize_reference, parse_amount, parse_date_flexible

SAMPLE_DIR = Path(__file__).resolve().parent.parent / "sample_data"

client = TestClient(app)


def test_parse_amount_handles_currency_formatting():
    assert parse_amount("$1,234.50") == 1234.50
    assert parse_amount("(180.00)") == -180.00
    assert parse_amount("") is None
    assert parse_amount(None) is None
    assert parse_amount("-45.5") == -45.5


def test_normalize_reference_strips_punctuation_and_leading_zeros():
    assert normalize_reference("INV-1001") == "INV1001"
    assert normalize_reference(" inv-1001 ") == "INV1001"
    assert normalize_reference("#00123") == "123"
    assert normalize_reference("") is None
    assert normalize_reference(None) is None


def test_parse_date_flexible_handles_common_formats():
    assert parse_date_flexible("2026-02-01").isoformat() == "2026-02-01"
    assert parse_date_flexible("02/01/2026").month == 2  # month-first default


def test_health_endpoint():
    resp = client.get("/api/health")
    assert resp.status_code == 200
    assert resp.json() == {"status": "ok"}


def test_full_reconciliation_against_sample_data():
    """This pins down the exact numbers a human would get running the sample
    vendor statement against the sample ledger, so regressions in the
    matching/reconciliation logic get caught immediately."""
    with open(SAMPLE_DIR / "vendor_statement.csv", "rb") as vf, open(SAMPLE_DIR / "internal_ledger.csv", "rb") as lf:
        resp = client.post(
            "/api/reconcile",
            files={
                "vendor_file": ("vendor_statement.csv", vf, "text/csv"),
                "ledger_file": ("internal_ledger.csv", lf, "text/csv"),
            },
        )
    assert resp.status_code == 200
    data = resp.json()

    totals = data["totals"]
    assert totals["vendor_total"] == 8541.85
    assert totals["ledger_total"] == 8431.85
    assert totals["difference"] == 110.0
    assert totals["exact_match_count"] == 11
    assert totals["probable_match_count"] == 1
    assert totals["mismatch_count"] == 1
    assert totals["unmatched_vendor_count"] == 1
    assert totals["unmatched_ledger_count"] == 1

    check = data["reconciliation_check"]
    assert check["is_fully_explained"] is True
    assert check["unexplained_residual"] == 0.0

    discrepancy_types = {d["type"] for d in data["discrepancies"]}
    assert discrepancy_types == {
        "unmatched_vendor",
        "unmatched_ledger",
        "amount_mismatch",
        "low_confidence_match",
    }

    assert "summary" in data and len(data["summary"]) > 50


def test_missing_amount_column_gives_helpful_error():
    bad_csv = b"Date,Reference,Description\n2026-01-01,REF1,Nothing to see here\n"
    good_csv = open(SAMPLE_DIR / "internal_ledger.csv", "rb").read()
    resp = client.post(
        "/api/reconcile",
        files={
            "vendor_file": ("bad.csv", bad_csv, "text/csv"),
            "ledger_file": ("internal_ledger.csv", good_csv, "text/csv"),
        },
    )
    assert resp.status_code == 422
    assert "amount" in resp.json()["detail"].lower()
