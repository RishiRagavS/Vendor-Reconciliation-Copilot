import ReconciliationRings from "./ReconciliationRings";
import "./SummaryCard.css";

export default function SummaryCard({ summary, totals, check }) {
  const totalTxns = totals.vendor_count + totals.ledger_count;
  const matchedTxns = (totals.exact_match_count + totals.probable_match_count) * 2;
  const matchRatio = totalTxns > 0 ? matchedTxns / totalTxns : 0;

  return (
    <div className="card summary-card">
      <div className="summary-card__rings">
        <ReconciliationRings state="result" matchRatio={matchRatio} size={132} />
        <span className={`pill ${check.is_fully_explained ? "pill--moss" : "pill--berry"}`}>
          {check.is_fully_explained ? "Fully explained" : "Residual unexplained"}
        </span>
      </div>
      <div className="summary-card__body">
        <span className="eyebrow">Reconciliation summary</span>
        <p className="summary-card__text">{summary}</p>
      </div>
    </div>
  );
}
