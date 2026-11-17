// Small inline icons and the placeholder art shown when an indicator has no preview image.
import type { Platform } from "./api";

export function LockIcon() {
  return (
    <svg className="ind-icon" viewBox="0 0 24 24" aria-hidden="true">
      <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  );
}

export function SearchIcon() {
  return (
    <svg className="ind-icon" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/** A candle-and-line motif in the platform's accent colour. */
export function PlatformArt({ platform }: { platform: Platform }) {
  const candles = [
    [10, 60, 44, 70, 1],
    [22, 52, 38, 62, 1],
    [34, 44, 30, 56, 0],
    [46, 48, 36, 58, 1],
    [58, 36, 24, 46, 1],
    [70, 40, 30, 52, 0],
    [82, 28, 18, 38, 1],
  ];
  return (
    <svg className={`ind-art ind-art--${platform}`} viewBox="0 0 96 80" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <defs>
        <linearGradient id={`ind-g-${platform}`} x1="0" x2="1">
          <stop offset="0" stopColor="currentColor" stopOpacity="0.15" />
          <stop offset="1" stopColor="currentColor" stopOpacity="0.55" />
        </linearGradient>
      </defs>
      {candles.map(([x, top, hi, bottom, up]) => (
        <g key={x} opacity="0.8">
          <line x1={x} x2={x} y1={hi} y2={bottom + 6} stroke="currentColor" strokeOpacity="0.45" />
          <rect x={x - 3} y={top} width="6" height={bottom - top} rx="1" fill={up ? "currentColor" : "none"} stroke="currentColor" />
        </g>
      ))}
      <path d="M4 64 C 24 58, 36 40, 52 44 S 78 26, 92 20" fill="none" stroke={`url(#ind-g-${platform})`} strokeWidth="2.5" />
    </svg>
  );
}
