// Trade Room signals: types, entry parsing, validation and formatting. No React here, so it is easy to test.

export type Direction = "BUY" | "SELL";

/** How a signal ended, or "active" while it is still running. Matches the Status filter on the Signals page. */
export type SignalStatus = "active" | "take_profit" | "stop_loss" | "breakeven" | "manual_close";

export const MAX_TAKE_PROFITS = 6;

export interface Channel {
  id: string;
  name: string;
  /** Optional small image shown before the name in the channel picker. */
  iconUrl?: string | null;
}

export interface Pair {
  symbol: string;
  name: string;
}

export const DEFAULT_PAIRS: Pair[] = [
  { symbol: "XAUUSD", name: "Gold / US Dollar" },
  { symbol: "XAGUSD", name: "Silver / US Dollar" },
  { symbol: "EURUSD", name: "Euro / US Dollar" },
  { symbol: "GBPUSD", name: "British Pound / US Dollar" },
  { symbol: "USDJPY", name: "US Dollar / Japanese Yen" },
  { symbol: "GBPJPY", name: "British Pound / Japanese Yen" },
  { symbol: "US30", name: "Dow Jones 30" },
  { symbol: "NAS100", name: "Nasdaq 100" },
  { symbol: "BTCUSD", name: "Bitcoin / US Dollar" },
];

/** What the form holds while someone is typing. Prices stay as text until they post. */
export interface SignalDraft {
  channelId: string;
  direction: Direction;
  pair: string;
  entry: string;
  takeProfits: string[]; // always MAX_TAKE_PROFITS long
  stopLoss: string;
  notes: string;
  chart: File | null;
  autoManage: boolean;
}

/** What gets sent to the server when they press Post Signal. */
export interface NewSignal {
  channelId: string;
  direction: Direction;
  pair: string;
  /** Single entry: entryFrom only. Zone: entryFrom and entryTo, in the order they were typed. */
  entryFrom: number;
  entryTo: number | null;
  takeProfits: number[];
  stopLoss: number;
  notes: string | null;
  chartUrl: string | null;
  autoManage: boolean;
}

/** A published signal, as the card shows it. */
export interface Signal extends NewSignal {
  id: string;
  channelName?: string;
  createdAt: string;
  status: SignalStatus;
  /** How many take profits have been hit so far (0 to takeProfits.length). */
  targetsHit: number;
}

export function emptyDraft(channelId = "", pair = "XAUUSD"): SignalDraft {
  return {
    channelId,
    direction: "BUY",
    pair,
    entry: "",
    takeProfits: Array.from({ length: MAX_TAKE_PROFITS }, () => ""),
    stopLoss: "",
    notes: "",
    chart: null,
    autoManage: true,
  };
}

function toNumber(text: string): number | null {
  const clean = text.replace(/[,\s]/g, "");
  if (!/^\d+(\.\d+)?$/.test(clean)) return null;
  const n = Number(clean);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Reads "4115.5", "4115.5 - 4112", "4115.5-4112", "4,115.5 – 4,112" or "4115.5 to 4112".
 * Returns null when it cannot be read.
 */
export function parseEntry(text: string): { from: number; to: number | null } | null {
  const t = text.trim();
  if (!t) return null;
  // A zone with only one side typed, e.g. "4115 -" right after pressing the zone button.
  if (/(?:-|–|—|\bto)$/i.test(t) || /^(?:-|–|—)/.test(t)) return null;
  const parts = t.split(/\s*(?:-|–|—|to)\s*/i).filter((p) => p.length > 0);
  if (parts.length === 1) {
    const from = toNumber(parts[0]);
    return from === null ? null : { from, to: null };
  }
  if (parts.length === 2) {
    const from = toNumber(parts[0]);
    const to = toNumber(parts[1]);
    if (from === null || to === null) return null;
    return from === to ? { from, to: null } : { from, to };
  }
  return null;
}

export type FieldErrors = Partial<Record<"channelId" | "pair" | "entry" | "stopLoss" | `tp${number}`, string>>;

export interface CheckResult {
  errors: FieldErrors;
  /** Things that look wrong but are allowed, such as a take profit on the wrong side of entry. */
  warnings: string[];
  signal: Omit<NewSignal, "chartUrl"> | null;
}

/** Checks the draft. Entry, TP1 and stop loss are required, as marked with * on the form. */
export function checkDraft(d: SignalDraft): CheckResult {
  const errors: FieldErrors = {};
  const warnings: string[] = [];

  if (!d.channelId) errors.channelId = "Pick a channel";
  if (!d.pair) errors.pair = "Pick a pair";

  const entry = parseEntry(d.entry);
  if (!d.entry.trim()) errors.entry = "Add an entry price or zone";
  else if (!entry) errors.entry = "Use a price like 4115.5 or a zone like 4115.5 - 4112";

  const tps: number[] = [];
  d.takeProfits.forEach((raw, i) => {
    const key = `tp${i + 1}` as const;
    if (!raw.trim()) {
      if (i === 0) errors[key] = "TP1 is required";
      return;
    }
    const n = toNumber(raw);
    if (n === null) errors[key] = "Not a valid price";
    else tps.push(n);
  });

  const sl = toNumber(d.stopLoss);
  if (!d.stopLoss.trim()) errors.stopLoss = "Stop loss is required";
  else if (sl === null) errors.stopLoss = "Not a valid price";

  if (entry && sl !== null) {
    const lo = Math.min(entry.from, entry.to ?? entry.from);
    const hi = Math.max(entry.from, entry.to ?? entry.from);
    const buy = d.direction === "BUY";
    if (buy ? sl >= lo : sl <= hi) {
      warnings.push(`Stop loss is ${buy ? "above" : "below"} entry on a ${buy ? "buy" : "sell"}. Check the direction.`);
    }
    if (tps.some((tp) => (buy ? tp <= hi : tp >= lo))) {
      warnings.push(`A take profit is ${buy ? "below" : "above"} entry on a ${buy ? "buy" : "sell"}. Check the direction.`);
    }
  }

  const ok = Object.keys(errors).length === 0 && entry !== null && sl !== null;
  return {
    errors,
    warnings,
    signal: ok
      ? {
          channelId: d.channelId,
          direction: d.direction,
          pair: d.pair,
          entryFrom: entry.from,
          entryTo: entry.to,
          takeProfits: tps,
          stopLoss: sl,
          notes: d.notes.trim() || null,
          autoManage: d.autoManage,
        }
      : null,
  };
}

const priceFmt = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 5 });

export function formatPrice(n: number): string {
  return priceFmt.format(n);
}

export function formatEntry(s: Pick<NewSignal, "entryFrom" | "entryTo">): string {
  if (s.entryTo === null) return formatPrice(s.entryFrom);
  const lo = Math.min(s.entryFrom, s.entryTo);
  const hi = Math.max(s.entryFrom, s.entryTo);
  return `${formatPrice(lo)} – ${formatPrice(hi)}`;
}

export function timeAgo(iso: string, now = Date.now()): string {
  const mins = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export const STATUS_LABEL: Record<SignalStatus, string> = {
  active: "Active",
  take_profit: "Take profit",
  stop_loss: "Stop loss",
  breakeven: "Breakeven",
  manual_close: "Manual close",
};

/** The line at the bottom of the card, e.g. "Target 1 hit" or "Stopped out". */
export function progressLabel(s: Pick<Signal, "status" | "targetsHit" | "takeProfits">): string {
  if (s.status === "stop_loss") return s.targetsHit > 0 ? `Stopped after target ${s.targetsHit}` : "Stopped out";
  if (s.status === "breakeven") return "Closed at breakeven";
  if (s.status === "manual_close") return "Closed manually";
  if (s.targetsHit >= s.takeProfits.length && s.takeProfits.length > 0) return "All targets hit";
  if (s.targetsHit > 0) return `Target ${s.targetsHit} hit`;
  return "Running";
}
