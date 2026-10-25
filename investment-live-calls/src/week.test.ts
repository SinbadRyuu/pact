// Run with: npx tsx --test investment-live-calls/src/week.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, buildWeek, dayKey, isoWeekday, monthLabel, projectWeekly, rangeLabel, relativeWeekLabel, timeRange, weekRange, weekStartKey, zonedTime, type LiveCall } from "./week";
import { buildIcs } from "./ics";

const LDN = "Europe/London";
const call = (over: Partial<LiveCall>): LiveCall => ({
  callId: "c1",
  title: "Markets Q&A",
  startsAt: "2026-10-22T17:00:00.000Z",
  endsAt: "2026-10-22T18:00:00.000Z",
  state: "upcoming",
  repeats: "none",
  ...over,
});

test("weeks run Monday to Sunday", () => {
  assert.equal(isoWeekday("2026-10-25"), 7);
  assert.equal(weekStartKey("2026-10-25"), "2026-10-19");
  assert.equal(weekStartKey("2026-10-19"), "2026-10-19");
  assert.equal(weekStartKey("2027-01-01"), "2026-12-28");
  assert.equal(addDays("2026-12-28", 7), "2027-01-04");
});

test("the week holding the October clock change is 169 hours long and starts at UK midnight", () => {
  const { from, to } = weekRange("2026-10-19", LDN);
  assert.equal(new Date(from).toISOString(), "2026-10-18T23:00:00.000Z"); // BST midnight
  assert.equal(new Date(to).toISOString(), "2026-10-26T00:00:00.000Z"); // GMT midnight
  assert.equal((to - from) / 3_600_000, 169);
});

test("wall-clock times convert on both sides of the March clock change", () => {
  assert.equal(new Date(zonedTime("2027-03-27", 18, 0, LDN)).toISOString(), "2027-03-27T18:00:00.000Z");
  assert.equal(new Date(zonedTime("2027-03-29", 18, 0, LDN)).toISOString(), "2027-03-29T17:00:00.000Z");
  assert.equal(new Date(zonedTime("2026-10-19", 9, 30, "America/New_York")).toISOString(), "2026-10-19T13:30:00.000Z");
});

test("a late-evening call in London lands on the next day in Sydney", () => {
  assert.equal(dayKey(Date.parse("2026-10-22T22:00:00Z"), LDN), "2026-10-22");
  assert.equal(dayKey(Date.parse("2026-10-22T22:00:00Z"), "Australia/Sydney"), "2026-10-23");
});

test("buildWeek groups by day, counts, and picks the live call first", () => {
  const calls = [
    call({ callId: "a", startsAt: "2026-10-22T17:00:00Z", endsAt: "2026-10-22T18:00:00Z", state: "ended" }),
    call({ callId: "b", startsAt: "2026-10-25T13:30:00Z", endsAt: "2026-10-25T14:30:00Z", state: "live" }),
    call({ callId: "c", startsAt: "2026-10-25T18:00:00Z", endsAt: "2026-10-25T19:00:00Z", state: "upcoming" }),
    call({ callId: "d", startsAt: "2026-10-24T10:00:00Z", endsAt: "2026-10-24T11:00:00Z", state: "cancelled" }),
    call({ callId: "e", startsAt: "2026-10-26T18:00:00Z", endsAt: "2026-10-26T19:00:00Z" }), // next Monday
  ];
  const w = buildWeek(calls, "2026-10-19", LDN);
  assert.deepEqual(w.days.map((d) => d.calls.length), [0, 0, 0, 1, 0, 1, 2]);
  assert.equal(w.total, 3);
  assert.equal(w.liveNow, 1);
  assert.equal(w.next?.callId, "b");
  assert.equal(w.projected, false);
});

test("the next call skips ended and cancelled ones", () => {
  const w = buildWeek(
    [call({ callId: "x", state: "ended" }), call({ callId: "y", startsAt: "2026-10-24T09:00:00Z", endsAt: "2026-10-24T10:00:00Z", state: "soon" })],
    "2026-10-19",
    LDN,
  );
  assert.equal(w.next?.callId, "y");
  assert.equal(w.liveNow, 0);
});

test("weekly calls past the server's window keep their UK time across the clock change", () => {
  // Thursday 18:00 BST = 17:00Z. Three weeks later it is 18:00 GMT = 18:00Z.
  const weekly = call({ callId: "w", repeats: "weekly", startsAt: "2026-10-22T17:00:00Z", endsAt: "2026-10-22T18:00:00Z" });
  const projected = projectWeekly([weekly], "2026-11-09", LDN);
  assert.equal(projected.length, 1);
  assert.equal(projected[0].startsAt, "2026-11-12T18:00:00.000Z");
  assert.equal(projected[0].endsAt, "2026-11-12T19:00:00.000Z");
  assert.equal(projected[0].projected, true);

  const w = buildWeek([weekly], "2026-11-09", LDN);
  assert.equal(w.projected, true);
  assert.equal(w.days[3].calls.length, 1);
  // One-off calls are never projected, and weeks before the window are never filled in.
  assert.equal(buildWeek([call({})], "2026-11-09", LDN).total, 0);
  assert.equal(buildWeek([weekly], "2026-10-12", LDN).total, 0);
});

test("labels", () => {
  assert.equal(monthLabel("2026-10-19"), "October 2026");
  assert.equal(monthLabel("2026-10-26"), "October – November 2026");
  assert.equal(monthLabel("2026-12-28"), "December 2026 – January 2027");
  assert.equal(rangeLabel("2026-10-19"), "19 Oct – 25 Oct");
  assert.deepEqual([0, 1, -1, 3, -2].map(relativeWeekLabel), ["This week", "Next week", "Last week", "In 3 weeks", "2 weeks ago"]);
  assert.deepEqual(timeRange(call({}), LDN), { range: "18:00 to 19:00", uk: null });
  assert.deepEqual(timeRange(call({}), "America/New_York"), { range: "13:00 to 14:00", uk: "18:00 UK time" });
});

test("calendar files", () => {
  const one = buildIcs(call({}), { pageUrl: "https://www.vtimpact.com/investment/calls", now: 0 });
  assert.match(one, /DTSTART:20261022T170000Z/);
  assert.ok(one.endsWith("END:VCALENDAR\r\n"));
  const series = buildIcs(call({ repeats: "weekly" }), { pageUrl: "https://x", series: true, skipped: ["2026-10-29T18:00:00Z"], now: 0 });
  assert.match(series, /DTSTART;TZID=Europe\/London:20261022T180000/);
  assert.match(series, /EXDATE;TZID=Europe\/London:20261029T180000/);
  assert.match(series, /RRULE:FREQ=WEEKLY/);
  for (const line of series.split("\r\n")) assert.ok(new TextEncoder().encode(line).length <= 75, line);
});
