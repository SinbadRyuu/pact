import { useId } from "react";

// Stand-in for the IMPACT "V" chevron. Swap for the landing page's logo asset if there is one.
export function ImpactMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 64 48" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0" stopColor="#4f8dff" />
          <stop offset="0.5" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#ec4fd2" />
        </linearGradient>
      </defs>
      <path d="M1 2h15l16 31L48 2h15L32 46z" fill={`url(#${id})`} />
      <path d="M20 2h8l4 8 4-8h8L32 25z" fill={`url(#${id})`} opacity="0.55" />
    </svg>
  );
}

export function ImpactWordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-3 ${className}`}>
      <ImpactMark className="h-9 w-12" />
      <span className="mr-[-0.45em] font-display text-xl font-medium tracking-[0.45em]">IMPACT</span>
    </span>
  );
}
