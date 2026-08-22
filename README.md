# Vendor Reconciliation Copilot

Upload a vendor statement of account and an internal ledger extract (both
CSV). The app normalizes both into a common schema, matches transactions
with a transparent rule-based engine, surfaces discrepancies with a
priority, computes a running balance for each source, and writes a
plain-English summary — all without a black-box LLM call anywhere in the
matching or math.

```
┌────────────────────────┐        HTTPS/JSON        ┌──────────────────────────────┐
│  frontend (React+Vite)  │ ───────────────────────▶ │  backend (FastAPI)            │
│  Cloudflare Pages        │ ◀─────────────────────── │  Render (free tier)           │
│  ponds → results         │      POST /api/reconcile │  normalize → match → totals   │
└────────────────────────┘                            └──────────────────────────────┘
```

## Quickstart (run both locally)

**Backend** (terminal 1):

```bash
cd backend
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

**Frontend** (terminal 2):

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173, click **Load sample data**, and you'll see a
full reconciliation run against the bundled example CSVs in a few seconds.

## Project layout

```
backend/
  app/
    normalize.py       CSV → common schema (flexible header detection)
    matching.py         deterministic multi-stage matching engine
    reconciliation.py   running balances, prioritized discrepancies, totals
    summary.py           template-based plain-English narrative
    main.py               FastAPI routes
  sample_data/            example vendor statement + ledger CSVs
  tests/                   pytest suite, including a pinned end-to-end check
  render.yaml               Render Blueprint (free tier)

frontend/
  src/
    components/            Hero, upload ponds, rings, summary, discrepancy
                            list, running-balance chart, matches table, ...
    lib/api.js               backend client
  public/sample-data/       same sample CSVs, bundled for offline demo
  wrangler.toml              optional CLI deploy config for Cloudflare Pages
```

Each half has its own README with deploy steps: [`backend/README.md`](backend/README.md),
[`frontend/README.md`](frontend/README.md).

## How this maps to the brief

- **Ingest + normalize.** `normalize.py` header-matches a wide set of common
  column-name variants (case/punctuation-insensitive) for date, reference,
  description, and amount (either a single `amount` column or separate
  `debit`/`credit` columns), producing one common `NormalizedTransaction`
  schema regardless of source formatting.
- **Match transactions.** `matching.py` is a plain, deterministic, staged
  pipeline (exact reference+amount → reference-match-but-amount-differs →
  amount/date/description fallback → unmatched) — no LLM in this path. Every
  match carries its `match_type`, a `confidence`, and a `reasoning` string
  naming exactly what evidence produced it, so it's auditable line by line.
- **Surface discrepancies.** `reconciliation.py` turns unmatched items,
  amount mismatches, and low-confidence fuzzy matches into a single
  discrepancy list.
- **Prioritize.** Discrepancies are ranked `high`/`medium`/`low` by dollar
  value, with same-reference amount-mismatches escalated regardless of size
  (same-reference-different-amount is the highest-risk category — duplicate
  or short payments) — see `_priority_for_unmatched` /
  `_priority_for_mismatch` / `_priority_for_probable_match` in
  `reconciliation.py`.
- **Correctness.** `reconciliation_check` proves the statement-vs-ledger
  dollar difference is fully explained by the discrepancies found (or
  reports exactly how much is unexplained). This is pinned down by an
  end-to-end pytest test against the sample data (`backend/tests/`).
- **Running balance + summary.** Both sources get an independent running
  balance series (configurable opening balance), and `summary.py` renders a
  deterministic, template-based plain-English paragraph over the computed
  numbers — fast, free, and traceable, not a generative call.

## Known simplifications (documented, not hidden)

- **Sign convention:** both CSVs are assumed to use the same sign convention
  (positive = charge/invoice, negative = payment/credit note). If your two
  systems use opposite conventions, flip one file's sign before uploading —
  see the note in `backend/README.md`.
- **1:1 matching only:** the engine doesn't currently split one invoice
  across multiple partial payments (many-to-one/one-to-many matching). Those
  show up as separate unmatched items on each side today; a natural next
  step noted in the backend README.
- **No persistence:** each `/api/reconcile` call is stateless — nothing is
  stored server-side. Fine for this exercise; add a datastore if you need
  history across sessions.
