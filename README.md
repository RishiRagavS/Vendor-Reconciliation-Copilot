# Vendor Reconciliation Copilot

A tool that takes a vendor statement of account and an internal ledger extract (both CSV), matches the transactions between them with a transparent, rule-based engine, and returns a running balance, a prioritized list of discrepancies, and a plain-English summary — with no black-box model deciding what matches what.

**Live app:** https://vendor-reconciliation-copilot.rishi-ragavs.workers.dev

---

## What it does

1. **Ingest** — upload a vendor statement CSV and an internal ledger CSV. Column names don't need to match exactly; a wide range of common headers (`Date` / `Transaction Date` / `Posting Date`, `Reference` / `Invoice No` / `Check No`, `Amount` or separate `Debit`/`Credit` columns, etc.) are auto-detected and normalized into one common schema.
2. **Match** — transactions are matched across the two files in four deterministic stages, run in order:
   1. **Exact match** — same reference, same amount.
   2. **Flag mismatch** — same reference, different amount (surfaced, never silently accepted).
   3. **Fallback match** — no reliable reference on one/both sides; matched on amount + a date window + description similarity.
   4. **Unmatched** — nothing left to pair it with; reported as a discrepancy.
3. **Reconcile** — every unmatched item and amount mismatch is priced out, and a `reconciliation_check` proves the statement-vs-ledger dollar difference is either fully explained by the discrepancies found, or reports exactly how much is still unexplained.
4. **Summarize** — a short, plain-English paragraph is generated from the computed numbers (template-based, not a generative call) explaining what was found and what to look at first.
5. **Present** — matches, a priority-ranked discrepancy list (high / medium / low), a running balance chart for each source, and the full matched-transactions table, all in one page.

## Why the matching is trustworthy

This was built against a specific requirement: the matching logic has to be transparent and inspectable, not a black box, and the reconciled balance has to be provably correct. So:

- Every match carries a `match_type`, a `confidence` score, and a `reasoning` string naming exactly what evidence produced it.
- The matching pipeline is plain Python — no LLM call anywhere in the matching or arithmetic path.
- The `reconciliation_check` in the API response is a literal proof: `statement_total − ledger_total` is decomposed into `unmatched_vendor_items − unmatched_ledger_items + amount_mismatches`, and the two numbers are asserted to be equal (or the residual is reported).
- This is pinned down by an automated test that runs the full pipeline against sample data and checks the numbers, not just that the app "runs."

## Design

Cream paper background, saturated koi-orange + metallic gold palette (moss/berry as functional accents for success/alert states), Fraunces (display) + DM Sans (body) + IBM Plex Mono (data) type. The circular "pond" upload zones, the sparkle motif, and the orbiting-rings loading/result indicator are deliberate callbacks to a reference illustration of koi circling in gold ring-work — the rings settle into a tighter overlap the more transactions matched cleanly. A custom glowing star cursor and a "How the matching works" diagram (the four stages above, drawn as a connected pipeline) round out the same visual language.

## Tech stack

| | |
|---|---|
| Backend | Python, FastAPI, pytest |
| Frontend | React, Vite, plain CSS (no UI framework) |
| Backend hosting | Render (free tier, Python 3.11.9 pinned) |
| Frontend hosting | Cloudflare (Git-connected Pages/Workers deploy) |

## Project structure

```
backend/
  app/
    normalize.py       CSV → common schema (flexible header detection)
    matching.py          deterministic multi-stage matching engine
    reconciliation.py    running balances, prioritized discrepancies, totals
    summary.py            template-based plain-English narrative
    main.py                 FastAPI routes
  sample_data/              example vendor statement + ledger CSVs
  tests/                     pytest suite, including a pinned end-to-end check
  render.yaml                 Render Blueprint (free tier, Python 3.11.9)
  requirements.txt

frontend/
  src/
    components/                Hero, HowItWorks diagram, upload ponds,
                                reconciliation rings, summary card, stat
                                badges, discrepancy list, running-balance
                                chart, matches table, settings panel, ...
    lib/api.js                    backend client
  public/
    sample-data/                 same sample CSVs, bundled for offline demo
    cursor-star.svg                custom cursor
```

## Running it locally

**Backend:**

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (in a second terminal):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, click **Load sample data**, and a full reconciliation runs against the bundled example CSVs in a few seconds. By default the frontend talks to `http://localhost:8000`; change the API URL anytime from the in-app **Settings** panel without rebuilding.

## Testing

```bash
cd backend
pip install -r requirements-dev.txt
pytest tests/ -v
```

Includes an end-to-end test that runs the sample vendor statement against the sample ledger and asserts the exact match counts, discrepancy counts, and reconciled totals — so a regression in the matching or arithmetic logic fails a test, not just "looks wrong" in the UI.

## API

`POST /api/reconcile` — multipart form: `vendor_file`, `ledger_file`, plus optional `vendor_opening_balance`, `ledger_opening_balance`, `amount_tolerance` (default `0.01`), `date_window_days` (default `3`). Returns the full reconciliation: summary, totals, matches, mismatches, discrepancies (priority-sorted), running balances, and the reconciliation check.

`GET /api/sample/vendor` / `GET /api/sample/ledger` — the bundled example CSVs.

`GET /api/health` — liveness check.

## Known simplifications

- **Sign convention:** both CSVs are assumed to use the same convention (positive = charge/invoice, negative = payment/credit note). If your two systems use opposite conventions, flip one file's sign before uploading.
- **1:1 matching only:** the engine doesn't currently split one invoice across multiple partial payments. Those show up as separate unmatched items on each side today — a natural next step.
- **No persistence:** each reconciliation is stateless; nothing is stored server-side.
- **Free-tier cold starts:** the backend spins down after ~15 minutes idle on Render's free plan and takes up to a minute to wake back up on the next request. The UI shows a "waking up the server…" message so this doesn't look broken.
