export default function Sparkle({ size = 14, className = "", style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      className={`sparkle ${className}`}
      style={style}
      aria-hidden="true"
    >
      <path d="M6 0 L7.2 4.8 L12 6 L7.2 7.2 L6 12 L4.8 7.2 L0 6 L4.8 4.8 Z" fill="currentColor" />
    </svg>
  );
}
