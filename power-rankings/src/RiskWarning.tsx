// The risk warning every page with performance data or bots must show. Wording fixed by compliance.
export const RISK_WARNING =
  "Trading involves significant risk. Past performance does not guarantee future results. Only trade with money you can afford to lose.";

export function RiskWarning({ className = "", children }: { className?: string; children?: React.ReactNode }) {
  return (
    <aside className={`pr-risk ${className}`} role="note" aria-label="Risk warning">
      <svg className="pr-risk__icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3 2.5 20h19L12 3Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
        <path d="M12 10v4.5M12 17.2v.3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <p>
        <strong>Risk warning.</strong> {RISK_WARNING}
        {children ? <> {children}</> : null}
      </p>
    </aside>
  );
}
