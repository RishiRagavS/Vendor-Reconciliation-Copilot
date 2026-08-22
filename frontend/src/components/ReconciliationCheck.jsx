import "./ReconciliationCheck.css";

const money = (v) => {
  const sign = v < 0 ? "\u2212" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function ReconciliationCheck({ totals, check }) {
  return (
    <div className="check-strip card">
      <h3 className="check-strip__heading">Reconciliation check</h3>
      <div className="check-strip__equation">
        <Term label="Vendor total" value={totals.vendor_total} />
        <Op>&minus;</Op>
        <Term label="Ledger total" value={totals.ledger_total} />
        <Op>=</Op>
        <Term label="Difference" value={check.statement_minus_ledger} emphasize />
      </div>
      <div className="check-strip__divider" />
      <div className="check-strip__equation check-strip__equation--breakdown">
        <Term label="Vendor-only items" value={check.explained_by_unmatched_vendor_items} />
        <Op>+</Op>
        <Term label="Ledger-only items" value={check.explained_by_unmatched_ledger_items} />
        <Op>+</Op>
        <Term label="Amount mismatches" value={check.explained_by_amount_mismatches} />
        <Op>=</Op>
        <Term label="Explained" value={check.total_explained} emphasize />
      </div>
      <div className={`check-strip__result ${check.is_fully_explained ? "check-strip__result--ok" : "check-strip__result--warn"}`}>
        {check.is_fully_explained ? (
          <>Fully explained — the discrepancies below account for the entire difference.</>
        ) : (
          <>
            {money(check.unexplained_residual)} is still unexplained after accounting for the discrepancies below —
            worth a closer look (possible split transaction or data-entry error).
          </>
        )}
      </div>
    </div>
  );
}

function Term({ label, value, emphasize }) {
  return (
    <div className={`check-strip__term ${emphasize ? "check-strip__term--emphasize" : ""}`}>
      <span className="check-strip__term-value mono">{money(value)}</span>
      <span className="check-strip__term-label">{label}</span>
    </div>
  );
}

function Op({ children }) {
  return <span className="check-strip__op">{children}</span>;
}
