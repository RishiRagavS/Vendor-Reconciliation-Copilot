import "./DiscrepancyList.css";

const PRIORITY_META = {
  high: { label: "High priority", accent: "berry" },
  medium: { label: "Medium priority", accent: "gold" },
  low: { label: "Low priority", accent: "moss" },
};

const TYPE_LABEL = {
  unmatched_vendor: "Vendor only",
  unmatched_ledger: "Ledger only",
  amount_mismatch: "Amount mismatch",
  low_confidence_match: "Needs review",
};

const money = (v) => {
  if (v === null || v === undefined) return "—";
  const sign = v < 0 ? "\u2212" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function DiscrepancyList({ discrepancies }) {
  if (discrepancies.length === 0) {
    return (
      <div className="card discrepancies discrepancies--empty">
        <p>No discrepancies found — every transaction matched cleanly.</p>
      </div>
    );
  }

  const groups = ["high", "medium", "low"]
    .map((priority) => ({ priority, items: discrepancies.filter((d) => d.priority === priority) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="discrepancies">
      {groups.map((group) => (
        <div key={group.priority} className="discrepancies__group">
          <div className="discrepancies__group-heading">
            <span className={`pill pill--${PRIORITY_META[group.priority].accent}`}>
              {PRIORITY_META[group.priority].label}
            </span>
            <span className="discrepancies__group-count">{group.items.length}</span>
          </div>
          <div className="discrepancies__list">
            {group.items.map((d, i) => (
              <DiscrepancyRow key={i} d={d} accent={PRIORITY_META[group.priority].accent} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function DiscrepancyRow({ d, accent }) {
  return (
    <div className={`disc-row disc-row--${accent}`}>
      <div className="disc-row__amount mono">{money(d.amount)}</div>
      <div className="disc-row__body">
        <div className="disc-row__top">
          <span className="pill pill--ink">{TYPE_LABEL[d.type] || d.type}</span>
          {d.reference && <span className="disc-row__ref mono">{d.reference}</span>}
          {d.date && <span className="disc-row__date">{d.date}</span>}
        </div>
        {d.description && <div className="disc-row__desc">{d.description}</div>}
        <div className="disc-row__reasoning">{d.reasoning}</div>
      </div>
    </div>
  );
}
