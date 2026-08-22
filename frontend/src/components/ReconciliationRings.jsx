import "./ReconciliationRings.css";

/**
 * state: "loading" | "result"
 * matchRatio: 0..1, only used when state === "result" — higher ratio pulls
 * the two rings into a tighter overlap, echoing the source artwork's
 * interlocking gold circles.
 */
export default function ReconciliationRings({ state = "loading", matchRatio = 0, size = 120 }) {
  const pivotX = 100;
  const pivotY = 60;

  // In "result" mode, translate matchRatio into an orbit radius: a perfect
  // match pulls the rings almost concentric; a poor match keeps them apart.
  const orbitA = state === "result" ? 8 + (1 - matchRatio) * 20 : 22;
  const orbitB = state === "result" ? 6 + (1 - matchRatio) * 14 : 16;
  const fullyReconciled = state === "result" && matchRatio >= 0.97;

  return (
    <div
      className={`rings rings--${state}`}
      style={{ width: size, height: (size * 120) / 200 }}
      role="img"
      aria-label={
        state === "loading"
          ? "Matching transactions"
          : `Reconciliation rings, ${Math.round(matchRatio * 100)} percent matched`
      }
    >
      <svg viewBox="0 0 200 120" width="100%" height="100%">
        <g transform={`translate(${pivotX} ${pivotY})`}>
          <g
            className="rings__orbit rings__orbit--a"
            style={state === "result" ? { transform: `translate(${-orbitA}px, 0)` } : { "--r": `${orbitA}px` }}
          >
            <circle r="40" className="rings__ring rings__ring--gold" />
          </g>
          <g
            className="rings__orbit rings__orbit--b"
            style={state === "result" ? { transform: `translate(${orbitB}px, 0)` } : { "--r": `${orbitB}px` }}
          >
            <circle r="30" className="rings__ring rings__ring--koi" />
          </g>
          {fullyReconciled && (
            <g className="rings__spark" transform="translate(0,-2)">
              <path d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z" />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
}
