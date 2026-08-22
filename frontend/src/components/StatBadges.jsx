import "./StatBadges.css";

const STATS = [
  { key: "exact_match_count", label: "Exact matches", accent: "gold" },
  { key: "probable_match_count", label: "Probable matches", accent: "koi" },
  { key: "mismatch_count", label: "Amount mismatches", accent: "berry" },
  { key: "unmatched_vendor_count", label: "Vendor-only items", accent: "ink" },
  { key: "unmatched_ledger_count", label: "Ledger-only items", accent: "ink" },
];

export default function StatBadges({ totals }) {
  return (
    <div className="stat-badges">
      {STATS.map((s) => (
        <div key={s.key} className={`stat-coin stat-coin--${s.accent}`}>
          <span className="stat-coin__value">{totals[s.key]}</span>
          <span className="stat-coin__label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
