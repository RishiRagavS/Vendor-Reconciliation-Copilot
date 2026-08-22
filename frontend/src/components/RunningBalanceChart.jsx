import { useMemo } from "react";
import "./RunningBalanceChart.css";

const W = 720;
const H = 280;
const PAD_L = 64;
const PAD_R = 24;
const PAD_T = 20;
const PAD_B = 36;

function buildSeries(points) {
  return points
    .filter((p) => p.date)
    .map((p) => ({ ...p, dateMs: new Date(p.date).getTime() }));
}

export default function RunningBalanceChart({ vendorSeries, ledgerSeries }) {
  const { vPoints, lPoints, xFor, yFor, yTicks, xTicks } = useMemo(() => {
    const vPoints = buildSeries(vendorSeries);
    const lPoints = buildSeries(ledgerSeries);
    const allMs = [...vPoints, ...lPoints].map((p) => p.dateMs);
    const allBal = [...vPoints, ...lPoints].map((p) => p.running_balance);

    const minMs = Math.min(...allMs);
    const maxMs = Math.max(...allMs);
    const rawMinBal = Math.min(0, ...allBal);
    const rawMaxBal = Math.max(0, ...allBal);
    const balRange = rawMaxBal - rawMinBal || 1;
    const minBal = rawMinBal - balRange * 0.08;
    const maxBal = rawMaxBal + balRange * 0.08;

    const innerW = W - PAD_L - PAD_R;
    const innerH = H - PAD_T - PAD_B;

    const xFor = (ms) => PAD_L + (maxMs === minMs ? innerW / 2 : ((ms - minMs) / (maxMs - minMs)) * innerW);
    const yFor = (bal) => PAD_T + innerH - ((bal - minBal) / (maxBal - minBal)) * innerH;

    const yTicks = [minBal, minBal + (maxBal - minBal) / 2, maxBal];
    const xTicks =
      allMs.length > 0
        ? [minMs, minMs + (maxMs - minMs) / 2, maxMs]
        : [];

    return { vPoints, lPoints, xFor, yFor, yTicks, xTicks };
  }, [vendorSeries, ledgerSeries]);

  if (vPoints.length === 0 && lPoints.length === 0) return null;

  const pathFor = (points) =>
    points.map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(p.dateMs).toFixed(1)} ${yFor(p.running_balance).toFixed(1)}`).join(" ");

  const fmtDate = (ms) => new Date(ms).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  const fmtMoney = (v) => `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

  return (
    <div className="balance-chart card">
      <div className="balance-chart__header">
        <h3 className="balance-chart__heading">Running balance</h3>
        <div className="balance-chart__legend">
          <span className="balance-chart__legend-item">
            <span className="balance-chart__swatch balance-chart__swatch--gold" /> Vendor statement
          </span>
          <span className="balance-chart__legend-item">
            <span className="balance-chart__swatch balance-chart__swatch--koi" /> Internal ledger
          </span>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="balance-chart__svg" role="img" aria-label="Running balance over time for the vendor statement and the internal ledger">
        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - PAD_R} y1={yFor(t)} y2={yFor(t)} className="balance-chart__gridline" />
            <text x={PAD_L - 10} y={yFor(t) + 4} className="balance-chart__axis-label balance-chart__axis-label--y">
              {fmtMoney(t)}
            </text>
          </g>
        ))}
        {xTicks.map((t, i) => (
          <text key={i} x={xFor(t)} y={H - PAD_B + 20} className="balance-chart__axis-label balance-chart__axis-label--x" textAnchor="middle">
            {fmtDate(t)}
          </text>
        ))}
        {lPoints.length > 0 && <path d={pathFor(lPoints)} className="balance-chart__line balance-chart__line--koi" />}
        {vPoints.length > 0 && <path d={pathFor(vPoints)} className="balance-chart__line balance-chart__line--gold" />}
        {vPoints.map((p, i) => (
          <circle key={`v${i}`} cx={xFor(p.dateMs)} cy={yFor(p.running_balance)} r="3" className="balance-chart__dot balance-chart__dot--gold" />
        ))}
        {lPoints.map((p, i) => (
          <circle key={`l${i}`} cx={xFor(p.dateMs)} cy={yFor(p.running_balance)} r="3" className="balance-chart__dot balance-chart__dot--koi" />
        ))}
      </svg>
    </div>
  );
}
