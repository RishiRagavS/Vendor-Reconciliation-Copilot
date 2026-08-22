import { useState } from "react";
import "./MatchesTable.css";

const money = (v) => {
  if (v === null || v === undefined) return "—";
  const sign = v < 0 ? "\u2212" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

export default function MatchesTable({ matches }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="matches-table card">
      <button className="matches-table__toggle" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span>
          Matched transactions <span className="matches-table__count">{matches.length}</span>
        </span>
        <ChevronIcon open={open} />
      </button>
      {open && (
        <div className="matches-table__scroll">
          <table>
            <thead>
              <tr>
                <th>Type</th>
                <th>Vendor ref</th>
                <th>Vendor date</th>
                <th className="matches-table__num">Vendor amount</th>
                <th>Ledger ref</th>
                <th>Ledger date</th>
                <th className="matches-table__num">Ledger amount</th>
                <th className="matches-table__num">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {matches.map((m, i) => (
                <tr key={i}>
                  <td>
                    <span className={`pill ${m.match_type === "exact_reference_amount" ? "pill--gold" : "pill--koi"}`}>
                      {m.match_type === "exact_reference_amount" ? "Exact" : "Probable"}
                    </span>
                  </td>
                  <td className="mono">{m.vendor_txn.reference || "—"}</td>
                  <td>{m.vendor_txn.date}</td>
                  <td className="mono matches-table__num">{money(m.vendor_txn.amount)}</td>
                  <td className="mono">{m.ledger_txn.reference || "—"}</td>
                  <td>{m.ledger_txn.date}</td>
                  <td className="mono matches-table__num">{money(m.ledger_txn.amount)}</td>
                  <td className="mono matches-table__num">{Math.round(m.confidence * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className={`matches-table__chevron ${open ? "matches-table__chevron--open" : ""}`}>
      <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
