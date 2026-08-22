import Sparkle from "./Sparkle";
import SparkleField from "./SparkleField";
import "./HowItWorks.css";

const HOW_SPARKLES = [
  { top: "4%", left: "6%", size: 20, delay: "0.3s" },
  { top: "10%", left: "94%", size: 26, delay: "1.1s", color: "koi" },
  { top: "80%", left: "50%", size: 10, delay: "1.9s" },
];

const STAGES = [
  {
    n: 1,
    title: "Exact match",
    desc: "Reference and amount agree on both sides.",
    accent: "gold",
  },
  {
    n: 2,
    title: "Flag mismatch",
    desc: "Same reference, different amount — surfaced, never silently matched.",
    accent: "berry",
  },
  {
    n: 3,
    title: "Fallback match",
    desc: "No reliable reference — matched on amount, a date window, and description similarity.",
    accent: "koi",
  },
  {
    n: 4,
    title: "Unmatched",
    desc: "Nothing left to pair it with — reported as a discrepancy, not dropped.",
    accent: "ink",
  },
];

export default function HowItWorks() {
  return (
    <section className="how">
      <SparkleField points={HOW_SPARKLES} />
      <div className="container">
        <span className="eyebrow">
          <Sparkle size={12} />
          How the matching works
        </span>
        <h2 className="how__heading">Four rules, run in order. Nothing hidden.</h2>
        <p className="how__sub">
          Each stage runs on what the one before it couldn&rsquo;t place, so every result traces
          back to exactly one rule — no model call decides who matches whom.
        </p>

        <div className="how__diagram">
          <div className="how__track" aria-hidden="true" />
          {STAGES.map((s) => (
            <div key={s.n} className={`how__stage how__stage--${s.accent}`}>
              <div className="how__node">
                <span className="how__node-num">{s.n}</span>
                {s.n === 1 && <Sparkle size={13} className="how__node-spark" />}
              </div>
              <h3 className="how__stage-title">{s.title}</h3>
              <p className="how__stage-desc">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
