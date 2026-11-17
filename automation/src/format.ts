// Formatting helpers for the Automation page.
const priceFmt = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 5 });
export const formatPrice = (n: number) => priceFmt.format(n);

export function formatEntry(from: number, to: number | null): string {
  if (to === null) return formatPrice(from);
  return `${formatPrice(Math.min(from, to))} – ${formatPrice(Math.max(from, to))}`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

export const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));

export const STATUS_LABEL: Record<string, string> = {
  active: "Running",
  take_profit: "Target hit",
  stop_loss: "Stopped out",
  breakeven: "Closed at breakeven",
  manual_close: "Closed manually",
};

/** Recommended Sniper Bot size: 0.01 lot per $1,000 of balance, rounded down, minimum 0.01. */
export function recommendedLots(balance: number): number {
  if (!Number.isFinite(balance) || balance <= 0) return 0;
  return Math.max(0.01, Math.floor(balance / 1000) / 100);
}
