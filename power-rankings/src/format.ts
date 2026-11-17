// Number and date formatting for Power Rankings.
const n1 = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
const price = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 5 });

/** "+1,234.5" / "−40" (true minus sign) / "0" */
export function pips(v: number | null | undefined, signed = true): string {
  if (v === null || v === undefined) return "–";
  const s = n1.format(Math.abs(v));
  if (!signed || v === 0) return v < 0 ? `−${s}` : s;
  return v > 0 ? `+${s}` : `−${s}`;
}
export const pct = (v: number) => `${n1.format(v)}%`;
export const num = (v: number) => n1.format(v);
export const fmtPrice = (v: number | null) => (v === null ? "–" : price.format(v));
export const profitFactor = (v: number | "inf" | null) => (v === null ? "–" : v === "inf" ? "∞" : v.toFixed(2));

export function dateTime(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short", year: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}
export function shortDate(iso: string, tz: string) {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, day: "numeric", month: "short", year: "numeric" }).format(new Date(iso));
}
export function monthLabel(ym: string, long = false) {
  const [y, m] = ym.split("-").map(Number);
  return new Intl.DateTimeFormat("en-GB", { month: long ? "long" : "short", year: long ? "numeric" : "2-digit", timeZone: "UTC" }).format(new Date(Date.UTC(y, m - 1, 1)));
}
export const tone = (v: number | null | undefined) => (!v ? "" : v > 0 ? "pr-pos" : "pr-neg");
export const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
