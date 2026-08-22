import Sparkle from "./Sparkle";
import "./SparkleField.css";

/**
 * `points` is an array of { top, left, size, delay, color } using % for
 * top/left so it scales with the container. Positions are hand-placed
 * (not random) so they stay put across renders and don't clash with content.
 */
export default function SparkleField({ points, className = "" }) {
  return (
    <div className={`sparkle-field ${className}`} aria-hidden="true">
      {points.map((p, i) => (
        <Sparkle
          key={i}
          size={p.size ?? 12}
          className="sparkle-field__star"
          style={{
            top: p.top,
            left: p.left,
            color: p.color === "koi" ? "var(--koi-light)" : "var(--gold-bright)",
            animationDelay: p.delay ?? "0s",
            opacity: p.opacity ?? 0.6,
          }}
        />
      ))}
    </div>
  );
}
