from __future__ import annotations

import os
from pathlib import Path

from fastapi import FastAPI, File, HTTPException, UploadFile, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse

from .matching import run_matching
from .normalize import NormalizationError, normalize_csv
from .reconciliation import build_reconciliation
from .summary import generate_summary

app = FastAPI(
    title="Vendor Reconciliation Copilot API",
    description="Matches a vendor statement against an internal ledger and returns a transparent, rule-based reconciliation.",
    version="1.0.0",
)

allowed_origins = os.environ.get("ALLOWED_ORIGINS", "*")
origins = ["*"] if allowed_origins.strip() == "*" else [o.strip() for o in allowed_origins.split(",")]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAMPLE_DIR = Path(__file__).resolve().parent.parent / "sample_data"
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB is generous for this use case


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/sample/{which}")
def sample_file(which: str):
    mapping = {"vendor": "vendor_statement.csv", "ledger": "internal_ledger.csv"}
    if which not in mapping:
        raise HTTPException(status_code=404, detail="Unknown sample file. Use 'vendor' or 'ledger'.")
    path = SAMPLE_DIR / mapping[which]
    if not path.exists():
        raise HTTPException(status_code=404, detail="Sample file not found on server.")
    return FileResponse(path, media_type="text/csv", filename=mapping[which])


async def _read_upload(upload: UploadFile, label: str) -> bytes:
    if upload.content_type not in (
        "text/csv",
        "application/vnd.ms-excel",
        "application/csv",
        "text/plain",
        None,
        "",
    ):
        # Don't hard-block on content type (browsers are inconsistent about it),
        # just make sure the extension looks sane.
        if upload.filename and not upload.filename.lower().endswith(".csv"):
            raise HTTPException(status_code=400, detail=f"{label} file must be a .csv file.")
    data = await upload.read()
    if len(data) == 0:
        raise HTTPException(status_code=400, detail=f"{label} file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=400, detail=f"{label} file is too large (max 5MB).")
    return data


@app.post("/api/reconcile")
async def reconcile(
    vendor_file: UploadFile = File(..., description="Vendor statement of account CSV"),
    ledger_file: UploadFile = File(..., description="Internal ledger extract CSV"),
    vendor_opening_balance: float = Form(0.0),
    ledger_opening_balance: float = Form(0.0),
    amount_tolerance: float = Form(0.01),
    date_window_days: int = Form(3),
):
    vendor_bytes = await _read_upload(vendor_file, "Vendor statement")
    ledger_bytes = await _read_upload(ledger_file, "Ledger")

    try:
        vendor_txns, vendor_meta = normalize_csv(vendor_bytes, source="vendor", id_prefix="V")
        ledger_txns, ledger_meta = normalize_csv(ledger_bytes, source="ledger", id_prefix="L")
    except NormalizationError as e:
        raise HTTPException(status_code=422, detail=str(e))

    if not vendor_txns:
        raise HTTPException(status_code=422, detail="No usable rows found in the vendor statement.")
    if not ledger_txns:
        raise HTTPException(status_code=422, detail="No usable rows found in the ledger.")

    matching = run_matching(
        vendor_txns,
        ledger_txns,
        amount_tolerance=amount_tolerance,
        date_window_days=date_window_days,
    )
    result = build_reconciliation(
        vendor_txns,
        ledger_txns,
        matching,
        vendor_opening_balance=vendor_opening_balance,
        ledger_opening_balance=ledger_opening_balance,
    )
    summary_text = generate_summary(result)

    return JSONResponse(
        {
            "summary": summary_text,
            "meta": {
                "vendor": vendor_meta,
                "ledger": ledger_meta,
                "settings": {
                    "amount_tolerance": amount_tolerance,
                    "date_window_days": date_window_days,
                    "vendor_opening_balance": vendor_opening_balance,
                    "ledger_opening_balance": ledger_opening_balance,
                },
            },
            "totals": {
                "vendor_total": result.vendor_total,
                "ledger_total": result.ledger_total,
                "difference": result.difference,
                "vendor_count": result.vendor_count,
                "ledger_count": result.ledger_count,
                "matched_count": result.matched_count,
                "exact_match_count": result.exact_match_count,
                "probable_match_count": result.probable_match_count,
                "mismatch_count": result.mismatch_count,
                "unmatched_vendor_count": result.unmatched_vendor_count,
                "unmatched_ledger_count": result.unmatched_ledger_count,
            },
            "matches": result.matches,
            "mismatches": result.mismatches,
            "discrepancies": result.discrepancies,
            "running_balance": {
                "vendor": result.running_balance_vendor,
                "ledger": result.running_balance_ledger,
            },
            "reconciliation_check": result.reconciliation_check,
        }
    )


@app.get("/")
def root():
    return {
        "service": "Vendor Reconciliation Copilot API",
        "docs": "/docs",
        "endpoints": ["/api/health", "/api/reconcile (POST)", "/api/sample/vendor", "/api/sample/ledger"],
    }
