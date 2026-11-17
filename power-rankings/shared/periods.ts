// Time periods for Power Rankings, shared by the server (which filters trades) and the page (which shows the picker).
// Weeks run Monday to Sunday. Every boundary is midnight in RANKINGS_TIMEZONE (default Europe/London, the site's
// reference time), so "this week" means the same thing for a member in Lagos as one in Manchester.
//
// Period keys (what goes in ?period=):
//   this-week | last-week | this-month | last-month | this-year | last-year | all
//   week:2026-W46 | month:2026-10 | year:2025 | custom:2026-10-01..2026-10-31 (both dates inclusive)

export const DEFAULT_TIMEZONE = "Europe/London";
const DAY = 86_400_000;

export interface Period {
  key: string;
  label: string;
  /** Inclusive start; null = from the beginning. */
  start: Date | null;
  /** Exclusive end. */
  end: Date;
  /** The period before, for rank change. */
  prevStart: Date | null;
  prevEnd: Date;
}

interface Ymd {
  y: number;
  m: number; // 1-12
  d: number;
}

const partsFmt = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string) {
  let f = partsFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-GB", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    partsFmt.set(tz, f);
  }
  return f;
}

/** Wall-clock parts of an instant in a time zone. */
function wallClock(ms: number, tz: string) {
  const p = Object.fromEntries(fmt(tz).formatToParts(new Date(ms)).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, mi: +p.minute, s: +p.second };
}

/** Offset of the zone from UTC at an instant, in ms (London in summer = +3,600,000). */
function offsetMs(ms: number, tz: string) {
  const w = wallClock(ms, tz);
  return Date.UTC(w.y, w.m - 1, w.d, w.h, w.mi, w.s) - Math.floor(ms / 1000) * 1000;
}

/** The instant that is midnight at the start of y-m-d in the zone. Handles DST changes. */
export function zonedMidnight({ y, m, d }: Ymd, tz: string): Date {
  const guess = Date.UTC(y, m - 1, d);
  const first = offsetMs(guess, tz);
  let t = guess - first;
  const second = offsetMs(t, tz);
  if (second !== first) t = guess - second;
  return new Date(t);
}

/** Calendar date of an instant in the zone. */
export function zonedDate(ms: number, tz: string): Ymd {
  const w = wallClock(ms, tz);
  return { y: w.y, m: w.m, d: w.d };
}

// Plain calendar arithmetic (no time zones involved), done on UTC dates.
const toUtc = ({ y, m, d }: Ymd) => Date.UTC(y, m - 1, d);
const fromUtc = (ms: number): Ymd => {
  const x = new Date(ms);
  return { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
};
const addDays = (date: Ymd, n: number) => fromUtc(toUtc(date) + n * DAY);
const addMonths = ({ y, m }: Ymd, n: number): Ymd => {
  const idx = y * 12 + (m - 1) + n;
  return { y: Math.floor(idx / 12), m: (idx % 12) + 1, d: 1 };
};
/** Monday = 0 … Sunday = 6 */
const weekday = (date: Ymd) => (new Date(toUtc(date)).getUTCDay() + 6) % 7;
const mondayOf = (date: Ymd) => addDays(date, -weekday(date));

/** ISO week (year + number) of a calendar date. */
export function isoWeek(date: Ymd): { year: number; week: number } {
  const thursday = addDays(date, 3 - weekday(date));
  const jan1 = Date.UTC(thursday.y, 0, 1);
  return { year: thursday.y, week: 1 + Math.floor((toUtc(thursday) - jan1) / DAY / 7) };
}

/** Monday of ISO week `week` in ISO year `year`. */
export function mondayOfIsoWeek(year: number, week: number): Ymd {
  const jan4: Ymd = { y: year, m: 1, d: 4 };
  return addDays(mondayOf(jan4), (week - 1) * 7);
}

const pad = (n: number) => String(n).padStart(2, "0");
export const weekKey = (date: Ymd) => {
  const w = isoWeek(date);
  return `week:${w.year}-W${pad(w.week)}`;
};
export const monthKey = ({ y, m }: Ymd) => `month:${y}-${pad(m)}`;

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const dayLabel = (d: Ymd, withYear = false) => `${d.d} ${MONTHS[d.m - 1]}${withYear ? ` ${d.y}` : ""}`;
const weekLabel = (monday: Ymd) => {
  const sunday = addDays(monday, 6);
  return `${dayLabel(monday, monday.y !== sunday.y)} – ${dayLabel(sunday, true)}`;
};

function parseYmd(s: string): Ymd | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const date = { y: +m[1], m: +m[2], d: +m[3] };
  const round = fromUtc(toUtc(date));
  return round.y === date.y && round.m === date.m && round.d === date.d ? date : null;
}

function range(key: string, label: string, from: Ymd, toExclusive: Ymd, prevFrom: Ymd, tz: string): Period {
  const start = zonedMidnight(from, tz);
  return { key, label, start, end: zonedMidnight(toExclusive, tz), prevStart: zonedMidnight(prevFrom, tz), prevEnd: start };
}

/** Turns a period key into exact instants. Unknown keys fall back to "this-week". */
export function resolvePeriod(key: string | null | undefined, now: Date, tz = DEFAULT_TIMEZONE): Period {
  const today = zonedDate(now.getTime(), tz);
  const monday = mondayOf(today);
  const month1: Ymd = { y: today.y, m: today.m, d: 1 };
  const k = (key ?? "").trim();

  switch (k) {
    case "last-week":
      return range(k, `Last week · ${weekLabel(addDays(monday, -7))}`, addDays(monday, -7), monday, addDays(monday, -14), tz);
    case "this-month":
      return range(k, `This month · ${MONTHS[today.m - 1]} ${today.y}`, month1, addMonths(month1, 1), addMonths(month1, -1), tz);
    case "last-month": {
      const lm = addMonths(month1, -1);
      return range(k, `Last month · ${MONTHS[lm.m - 1]} ${lm.y}`, lm, month1, addMonths(month1, -2), tz);
    }
    case "this-year":
      return range(k, `This year · ${today.y}`, { y: today.y, m: 1, d: 1 }, { y: today.y + 1, m: 1, d: 1 }, { y: today.y - 1, m: 1, d: 1 }, tz);
    case "last-year":
      return range(k, `Last year · ${today.y - 1}`, { y: today.y - 1, m: 1, d: 1 }, { y: today.y, m: 1, d: 1 }, { y: today.y - 2, m: 1, d: 1 }, tz);
    case "all": {
      // Rank change for all time = where everyone stood a week ago.
      const end = zonedMidnight(addDays(today, 1), tz);
      return { key: "all", label: "All time", start: null, end, prevStart: null, prevEnd: new Date(end.getTime() - 7 * DAY) };
    }
  }

  let m: RegExpExecArray | null;
  if ((m = /^week:(\d{4})-W(\d{1,2})$/.exec(k)) && +m[2] >= 1 && +m[2] <= 53) {
    const mon = mondayOfIsoWeek(+m[1], +m[2]);
    return range(`week:${m[1]}-W${pad(+m[2])}`, `Week ${+m[2]} · ${weekLabel(mon)}`, mon, addDays(mon, 7), addDays(mon, -7), tz);
  }
  if ((m = /^month:(\d{4})-(\d{2})$/.exec(k)) && +m[2] >= 1 && +m[2] <= 12) {
    const first: Ymd = { y: +m[1], m: +m[2], d: 1 };
    return range(k, `${MONTHS[first.m - 1]} ${first.y}`, first, addMonths(first, 1), addMonths(first, -1), tz);
  }
  if ((m = /^year:(\d{4})$/.exec(k))) {
    const y = +m[1];
    return range(k, String(y), { y, m: 1, d: 1 }, { y: y + 1, m: 1, d: 1 }, { y: y - 1, m: 1, d: 1 }, tz);
  }
  if ((m = /^custom:(\d{4}-\d{2}-\d{2})\.\.(\d{4}-\d{2}-\d{2})$/.exec(k))) {
    let a = parseYmd(m[1]);
    let b = parseYmd(m[2]);
    if (a && b) {
      if (toUtc(a) > toUtc(b)) [a, b] = [b, a];
      const days = Math.round((toUtc(b) - toUtc(a)) / DAY) + 1;
      // Previous period = the same number of days immediately before.
      return range(`custom:${m[1]}..${m[2]}`, `${dayLabel(a, true)} – ${dayLabel(b, true)}`, a, addDays(b, 1), addDays(a, -days), tz);
    }
  }

  // Default: this week.
  return range("this-week", `This week · ${weekLabel(monday)}`, monday, addDays(monday, 7), addDays(monday, -7), tz);
}

export const QUICK_PERIODS = [
  { key: "this-week", label: "This week" },
  { key: "last-week", label: "Last week" },
  { key: "this-month", label: "This month" },
  { key: "last-month", label: "Last month" },
  { key: "this-year", label: "This year" },
  { key: "last-year", label: "Last year" },
  { key: "all", label: "All time" },
] as const;

/** Options for the "Jump to" dropdown: recent weeks, recent months, and every year since the first trade. */
export function jumpOptions(now: Date, tz = DEFAULT_TIMEZONE, firstTradeYear?: number | null, weeks = 26, months = 24) {
  const today = zonedDate(now.getTime(), tz);
  const monday = mondayOf(today);
  const weekOpts = Array.from({ length: weeks }, (_, i) => {
    const mon = addDays(monday, -7 * i);
    const w = isoWeek(mon);
    return { key: weekKey(mon), label: `Week ${w.week} · ${weekLabel(mon)}` };
  });
  const first: Ymd = { y: today.y, m: today.m, d: 1 };
  const monthOpts = Array.from({ length: months }, (_, i) => {
    const mm = addMonths(first, -i);
    return { key: monthKey(mm), label: `${MONTHS[mm.m - 1]} ${mm.y}` };
  });
  const fromYear = Math.min(firstTradeYear ?? today.y, today.y);
  const yearOpts = Array.from({ length: today.y - fromYear + 1 }, (_, i) => ({ key: `year:${today.y - i}`, label: String(today.y - i) }));
  return { weeks: weekOpts, months: monthOpts, years: yearOpts };
}

/** "2026-10" for an instant, in the zone. Used for the monthly breakdown. */
export function monthOf(ms: number, tz = DEFAULT_TIMEZONE) {
  const d = zonedDate(ms, tz);
  return `${d.y}-${pad(d.m)}`;
}
