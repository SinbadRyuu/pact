// "Add to calendar" files (RFC 5545). A single call is written in UTC. A weekly series is written in UK time with
// the Europe/London rules, so it stays at the same time in people's calendars after the clocks change.
import { UK_ZONE, dayKey, type LiveCall } from "./week";

const VTIMEZONE = [
  "BEGIN:VTIMEZONE",
  "TZID:Europe/London",
  "BEGIN:DAYLIGHT",
  "TZOFFSETFROM:+0000",
  "TZOFFSETTO:+0100",
  "TZNAME:BST",
  "DTSTART:19700329T010000",
  "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
  "END:DAYLIGHT",
  "BEGIN:STANDARD",
  "TZOFFSETFROM:+0100",
  "TZOFFSETTO:+0000",
  "TZNAME:GMT",
  "DTSTART:19701025T020000",
  "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
  "END:STANDARD",
  "END:VTIMEZONE",
];

const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
const utcStamp = (ms: number) => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");

const ukParts = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23", timeZone: UK_ZONE });
function ukLocal(ms: number) {
  return `${dayKey(ms, UK_ZONE).replace(/-/g, "")}T${ukParts.format(ms).replace(/:/g, "")}`;
}

/** Lines longer than 75 bytes are folded with a leading space, as the format requires. */
function fold(line: string): string {
  const bytes = new TextEncoder();
  const out: string[] = [];
  let current = "";
  for (const ch of line) {
    if (bytes.encode(current + ch).length > (out.length ? 74 : 75)) {
      out.push(current);
      current = ch;
    } else current += ch;
  }
  out.push(current);
  return out.join("\r\n ");
}

export function buildIcs(call: LiveCall, opts: { pageUrl: string; series?: boolean; skipped?: string[]; now?: number }): string {
  const start = Date.parse(call.startsAt);
  const end = Date.parse(call.endsAt);
  const notes = [call.description, call.host ? `With ${call.host}` : null, `Schedule and join link: ${opts.pageUrl}`, "General education only, not financial advice."]
    .filter(Boolean)
    .join("\n\n");
  const event = [
    "BEGIN:VEVENT",
    `UID:${opts.series ? call.callId : `${call.callId}-${call.startsAt}`}@vtimpact.com`,
    `DTSTAMP:${utcStamp(opts.now ?? Date.now())}`,
    ...(opts.series
      ? [
          `DTSTART;TZID=Europe/London:${ukLocal(start)}`,
          `DTEND;TZID=Europe/London:${ukLocal(end)}`,
          "RRULE:FREQ=WEEKLY",
          ...(opts.skipped ?? []).map((s) => `EXDATE;TZID=Europe/London:${ukLocal(Date.parse(s))}`),
        ]
      : [`DTSTART:${utcStamp(start)}`, `DTEND:${utcStamp(end)}`]),
    `SUMMARY:${escape(`Impact Investment: ${call.title}`)}`,
    `DESCRIPTION:${escape(notes)}`,
    `URL:${opts.pageUrl}`,
    "END:VEVENT",
  ];
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//VT Impact//Impact Investment//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...(opts.series ? VTIMEZONE : []),
    ...event,
    "END:VCALENDAR",
  ]
    .map(fold)
    .join("\r\n")
    .concat("\r\n");
}

export function downloadIcs(call: LiveCall, all: LiveCall[], series: boolean) {
  const skipped = all.filter((c) => c.callId === call.callId && c.state === "cancelled").map((c) => c.startsAt);
  const text = buildIcs(call, { pageUrl: `${window.location.origin}/investment/calls`, series, skipped });
  const url = URL.createObjectURL(new Blob([text], { type: "text/calendar;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `impact-investment-${series ? "weekly-call" : `call-${call.startsAt.slice(0, 10)}`}.ics`;
  a.hidden = true;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
