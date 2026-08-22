import Sparkle from "./Sparkle";
import SparkleField from "./SparkleField";
import "./Hero.css";

const HERO_SPARKLES = [
  { top: "62%", left: "72%", size: 12, delay: "0.9s" },
  { top: "80%", left: "60%", size: 8, delay: "1.9s", color: "koi" },
];

export default function Hero() {
  return (
    <header className="hero">
      <div className="hero__deco" aria-hidden="true">
        <svg viewBox="0 0 420 420" width="420" height="420">
          <circle cx="230" cy="150" r="150" />
          <circle cx="120" cy="260" r="95" />
          <g className="hero__deco-spark" transform="translate(336 44) scale(1.3)">
            <path d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z" />
          </g>
          <g className="hero__deco-spark hero__deco-spark--sm" transform="translate(53 327) scale(0.9)">
            <path d="M0 -9 L2.2 -2.2 L9 0 L2.2 2.2 L0 9 L-2.2 2.2 L-9 0 L-2.2 -2.2 Z" />
          </g>
        </svg>
      </div>
      <SparkleField points={HERO_SPARKLES} className="hero__sparkles" />
      <div className="container">
        <div className="hero__inner">
          <span className="eyebrow">
            <Sparkle size={12} />
            Vendor Reconciliation Copilot
          </span>
          <h1 className="hero__title">
            Two ledgers, <em>one clear picture.</em>
          </h1>
          <p className="hero__sub">
            Upload your vendor statement and your internal ledger. Every match, mismatch, and
            missing transaction is found by rules you can read — not a black box — and laid
            out with a running balance and a plain-English summary.
          </p>
        </div>
      </div>
    </header>
  );
}
