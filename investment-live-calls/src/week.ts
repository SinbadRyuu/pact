// Pure week and time-zone helpers for the Live calls page. No React, no network: everything here is unit tested.
//
// Days are handled as calendar keys ("YYYY-MM-DD") in a named time zone, so adding days or finding a Monday never
// goes wrong across the clock changes in March and October.

export type CallState = "upcoming" | "soon" | "live" | "ended" | "cancelled";

/** One occurrence of a live call, as `GET /investment/calls` returns it. */
export interface LiveCall {
  callId: string;
  title: string;
  description?: string | null;
  host?: string | null;
  startsAt: string;
  endsAt: string;
  state: CallState;
  joinUrl?: string | null;
  hasJoinUrl?: boolean;
  repeats: "weekly" | "none";
}

/** A call shown in a week. `projected` marks a weekly call worked out on this device, past the server's window. */
export interface WeekCall extends LiveCall {
  projected?: boolean;
}

export const UK_ZONE = "Europe/London";
const DAY_MS = 86_400_000;

export function viewerZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || UK_ZONE;
  } catch {
    return UK_ZONE;
  }
}

// Intl formatters are slow to build, so each one is made once per zone.
const cache = new Map<string, Intl.DateTimeFormat>();
function fmt(id: string, make: () => Intl.DateTimeFormat) {
  let f = cache.get(id);
  if (!f) cache.set(id, (f = make()));
  return f;
}

const keyFmt = (zone: string) =>
  fmt(`key|${zone}`, () => new Intl.DateTimeFormat("en-CA", { year: "numeric", month: "2-digit", day: "2-digit", timeZone: zone }));

const partsFmt = (zone: string) =>
  fmt(`parts|${zone}`, () =>
    new Intl.DateTimeFormat("en-GB", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
      timeZone: zone,
    }),
  );

export const clockFmt = (zone: string) =>
  fmt(`clock|${zone}`, () => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: zone }));

/** The calendar day an instant falls on in `zone`. */
export function dayKey(instant: Date | number, zone: string): string {
  return keyFmt(zone).format(instant);
}

/** Adds whole days to a calendar key. */
export function addDays(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** 1 for Monday through 7 for Sunday. */
export function isoWeekday(key: string): number {
  const d = new Date(`${key}T12:00:00Z`).getUTCDay();
  return d === 0 ? 7 : d;
}

export const weekStartKey = (key: string) => addDays(key, 1 - isoWeekday(key));
export const weekDays = (startKey: string) => Array.from({ length: 7 }, (_, i) => addDays(startKey, i));

/** Whole days from one key to another. */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) / DAY_MS);
}

/** How far `zone` is ahead of UTC at an instant, in milliseconds. */
function zoneOffset(instant: number, zone: string): number {
  const p = Object.fromEntries(partsFmt(zone).formatToParts(instant).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return asUtc - Math.floor(instant / 1000) * 1000;
}

/** The instant a wall-clock time happens on a day in `zone`. */
export function zonedTime(key: string, hour: number, minute: number, zone: string): number {
  const [y, m, d] = key.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, hour, minute);
  // Two passes settle the offset on either side of a clock change.
  const first = wall - zoneOffset(wall, zone);
  return wall - zoneOffset(first, zone);
}

/** The start and end (exclusive) of a Monday-to-Sunday week, as instants. */
export function weekRange(startKey: string, zone: string) {
  return { from: zonedTime(startKey, 0, 0, zone), to: zonedTime(addDays(startKey, 7), 0, 0, zone) };
}

/** Hour and minute of an instant in `zone`. */
function wallClock(instant: number, zone: string) {
  const p = Object.fromEntries(partsFmt(zone).formatToParts(instant).map((x) => [x.type, x.value]));
  return { hour: +p.hour, minute: +p.minute };
}

/**
 * Weekly calls for a week the server has not sent yet. Each weekly series is carried forward from its latest
 * occurrence at the same UK wall-clock time, so it stays at 18:00 UK time after the clocks change.
 * Only used for weeks that start after every occurrence the server returned.
 */
export function projectWeekly(calls: LiveCall[], startKey: string, zone: string): WeekCall[] {
  const { from, to } = weekRange(startKey, zone);
  const latest = new Map<string, LiveCall>();
  for (const c of calls) {
    if (c.repeats !== "weekly") continue;
    const seen = latest.get(c.callId);
    if (!seen || Date.parse(c.startsAt) > Date.parse(seen.startsAt)) latest.set(c.callId, c);
  }
  const out: WeekCall[] = [];
  for (const base of latest.values()) {
    const start = Date.parse(base.startsAt);
    const length = Date.parse(base.endsAt) - start;
    const ukDay = dayKey(start, UK_ZONE);
    const { hour, minute } = wallClock(start, UK_ZONE);
    // Jump straight to the target week, then check the neighbours either side.
    const k0 = Math.max(1, Math.floor(daysBetween(ukDay, startKey) / 7));
    for (let k = k0 - 1; k <= k0 + 1; k++) {
      if (k < 1) continue;
      const s = zonedTime(addDays(ukDay, 7 * k), hour, minute, UK_ZONE);
      if (s >= from && s < to) {
        out.push({
          ...base,
          startsAt: new Date(s).toISOString(),
          endsAt: new Date(s + length).toISOString(),
          state: "upcoming",
          joinUrl: null,
          projected: true,
        });
      }
    }
  }
  return out;
}

export const isOpen = (c: LiveCall) => c.state !== "ended" && c.state !== "cancelled";

export interface WeekDay {
  key: string;
  calls: WeekCall[];
}

export interface WeekView {
  startKey: string;
  from: number;
  to: number;
  days: WeekDay[];
  /** Calls this week that are not cancelled. */
  total: number;
  liveNow: number;
  /** The live or next call this week, if any. */
  next: WeekCall | null;
  /** True when the server's data stops before this week and weekly calls were projected. */
  projected: boolean;
}

/** Everything the page shows for one week. */
export function buildWeek(calls: LiveCall[], startKey: string, zone: string): WeekView {
  const { from, to } = weekRange(startKey, zone);
  const horizon = calls.reduce((max, c) => Math.max(max, Date.parse(c.startsAt)), -Infinity);
  let inWeek: WeekCall[] = calls.filter((c) => {
    const s = Date.parse(c.startsAt);
    return s >= from && s < to;
  });
  const projected = inWeek.length === 0 && Number.isFinite(horizon) && from > horizon;
  if (projected) inWeek = projectWeekly(calls, startKey, zone);
  inWeek.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));

  const days = weekDays(startKey).map((key) => ({ key, calls: inWeek.filter((c) => dayKey(Date.parse(c.startsAt), zone) === key) }));
  const live = inWeek.filter((c) => c.state === "live");
  return {
    startKey,
    from,
    to,
    days,
    total: inWeek.filter((c) => c.state !== "cancelled").length,
    liveNow: live.length,
    next: live[0] ?? inWeek.find(isOpen) ?? null,
    projected: projected && inWeek.length > 0,
  };
}

// ---- Labels -------------------------------------------------------------------------------------------------

const noon = (key: string) => new Date(`${key}T12:00:00Z`);
const utc = (opts: Intl.DateTimeFormatOptions) => fmt(`utc|${JSON.stringify(opts)}`, () => new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }));

export const weekdayShort = (key: string) => utc({ weekday: "short" }).format(noon(key));
export const weekdayLong = (key: string) => utc({ weekday: "long" }).format(noon(key));
export const dayOfMonth = (key: string) => String(Number(key.slice(8)));
export const longDate = (key: string) => utc({ weekday: "long", day: "numeric", month: "long" }).format(noon(key));

/** "October 2026", "October – November 2026" or "December 2026 – January 2027". */
export function monthLabel(startKey: string): string {
  const end = addDays(startKey, 6);
  const month = utc({ month: "long" });
  const [ys, ye] = [startKey.slice(0, 4), end.slice(0, 4)];
  if (startKey.slice(0, 7) === end.slice(0, 7)) return `${month.format(noon(startKey))} ${ys}`;
  if (ys === ye) return `${month.format(noon(startKey))} – ${month.format(noon(end))} ${ye}`;
  return `${month.format(noon(startKey))} ${ys} – ${month.format(noon(end))} ${ye}`;
}

/** "19 Oct – 25 Oct". */
export function rangeLabel(startKey: string): string {
  const f = utc({ day: "numeric", month: "short" });
  return `${f.format(noon(startKey))} – ${f.format(noon(addDays(startKey, 6)))}`;
}

/** "This week", "Next week", "Last week", "In 3 weeks", "3 weeks ago". */
export function relativeWeekLabel(offset: number): string {
  if (offset === 0) return "This week";
  if (offset === 1) return "Next week";
  if (offset === -1) return "Last week";
  return offset > 1 ? `In ${offset} weeks` : `${-offset} weeks ago`;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const callCount = (n: number) => `${n} ${n === 1 ? "call" : "calls"}`;

/** "18:00 to 19:00", plus the UK time when the viewer is somewhere else. */
export function timeRange(call: LiveCall, zone: string) {
  const start = new Date(call.startsAt);
  const local = clockFmt(zone);
  const uk = clockFmt(UK_ZONE).format(start);
  const sameAsUk = uk === local.format(start) && dayKey(start, UK_ZONE) === dayKey(start, zone);
  return { range: `${local.format(start)} to ${local.format(new Date(call.endsAt))}`, uk: sameAsUk ? null : `${uk} UK time` };
}

/** "in 45 min", "in 2 h 10 min", "in 3 days". */
export function startsIn(startsAt: string, now: number): string {
  const min = Math.max(1, Math.ceil((Date.parse(startsAt) - now) / 60_000));
  if (min >= 2880) return `in ${Math.round(min / 1440)} days`;
  if (min >= 60) {
    const h = Math.floor(min / 60);
    const m = min % 60;
    return m ? `in ${h} h ${m} min` : `in ${h} h`;
  }
  return `in ${min} min`;
}
