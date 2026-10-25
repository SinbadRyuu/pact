// Impact Investment: Live calls (/investment/calls)
//
// The weekly lineup: a banner with week navigation and "Add call", a Monday-to-Sunday day strip, the up-next card
// with this week's counts and time zone, and an agenda with one expandable row per day.
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { LIVE_CALLS_KEY, liveCallsDeps } from "./adapters";
import { AddCallDialog } from "./AddCallDialog";
import { downloadIcs } from "./ics";
import { Icon } from "./icons";
import {
  UK_ZONE,
  addDays,
  buildWeek,
  callCount,
  dayKey,
  dayOfMonth,
  daysBetween,
  isOpen,
  longDate,
  monthLabel,
  pad2,
  rangeLabel,
  relativeWeekLabel,
  startsIn,
  timeRange,
  viewerZone,
  weekdayLong,
  weekdayShort,
  weekRange,
  weekStartKey,
  type CallState,
  type LiveCall,
  type WeekCall,
} from "./week";
import banner from "./assets/live-calls-banner.jpg";
import desk from "./assets/live-calls-desk.jpg";
import "./live-calls.css";

const STATE: Record<CallState, { label: string; tone: "neutral" | "accent" | "positive" | "outline" | "negative" }> = {
  upcoming: { label: "Upcoming", tone: "neutral" },
  soon: { label: "Starting soon", tone: "accent" },
  live: { label: "Live now", tone: "positive" },
  ended: { label: "Ended", tone: "outline" },
  cancelled: { label: "Cancelled", tone: "negative" },
};

/** Ticks every 15 seconds when the app does not pass its own clock. */
function useLocalNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const noop = () => {};

export function LiveCallsPage() {
  const deps = liveCallsDeps();
  // Hooks chosen once at start-up through configureLiveCalls, so the call order never changes between renders.
  const now = (deps.useNow ?? useLocalNow)();
  const canManage = deps.useCanManage();
  (deps.usePageTitle ?? noop)("Live calls");

  const zone = useMemo(viewerZone, []);
  const todayKey = dayKey(now, zone);
  const thisWeek = weekStartKey(todayKey);
  const [offset, setOffset] = useState(0);
  const startKey = addDays(thisWeek, offset * 7);
  const range = weekRange(startKey, zone);

  const query = useQuery({
    queryKey: [...LIVE_CALLS_KEY, "week", startKey, zone],
    queryFn: ({ signal }) =>
      deps.get<{ calls: LiveCall[] }>("/investment/calls", {
        signal,
        // The server can use these to send any week. If it ignores them, the page filters and projects instead.
        query: { from: new Date(range.from).toISOString(), to: new Date(range.to).toISOString() },
      }),
    placeholderData: keepPreviousData,
    refetchInterval: 60_000,
  });

  const calls = query.data?.calls ?? [];
  const week = useMemo(() => buildWeek(calls, startKey, zone), [calls, startKey, zone]);
  const ready = query.data !== undefined && !query.isPlaceholderData;

  // Which day is picked in the strip, and which agenda rows are open.
  const [selected, setSelected] = useState(todayKey);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const autoOpened = useRef<string | null>(null);
  // A day to land on after the week changes (set when a new call is scheduled in another week).
  const landOn = useRef<string | null>(null);
  useEffect(() => {
    const inWeek = (k: string) => daysBetween(startKey, k) >= 0 && daysBetween(startKey, k) < 7;
    const target = landOn.current && inWeek(landOn.current) ? landOn.current : null;
    landOn.current = null;
    setSelected(target ?? (inWeek(todayKey) ? todayKey : startKey));
    setOpen(new Set(target ? [target] : []));
    autoOpened.current = target ? startKey : null;
  }, [startKey, todayKey]);
  useEffect(() => {
    // Once a week's calls arrive, open the first day that still has something coming up.
    if (!ready || autoOpened.current === startKey) return;
    autoOpened.current = startKey;
    const first = week.days.find((d) => d.calls.some(isOpen));
    if (first) setOpen(new Set([first.key]));
  }, [ready, startKey, week]);

  const rowRefs = useRef(new Map<string, HTMLButtonElement>());
  function pickDay(key: string) {
    setSelected(key);
    setOpen((s) => new Set(s).add(key));
    const el = rowRefs.current.get(key);
    if (el) {
      const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "nearest" });
      el.focus({ preventScroll: true });
    }
  }
  const toggle = (key: string) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  // Add call: the date field starts on the chosen day.
  const [adding, setAdding] = useState<string | null>(null);
  function scheduled(ukDate: string) {
    const sameWeek = weekStartKey(ukDate) === startKey;
    landOn.current = sameWeek ? null : ukDate;
    autoOpened.current = weekStartKey(ukDate);
    setOffset(daysBetween(thisWeek, weekStartKey(ukDate)) / 7);
    // Same week: the effect above will not run, so land on the day here.
    setSelected(ukDate);
    setOpen((s) => new Set(s).add(ukDate));
  }

  const ids = { title: useId(), agenda: useId(), status: useId() };
  const weekOver = week.to <= now;

  return (
    <div className="lc">
      <section className="lc-hero" aria-labelledby={ids.title}>
        <img className="lc-hero__art" src={banner} alt="" decoding="async" />
        <div className="lc-hero__text">
          <p className="lc-eyebrow">
            Impact Investment <span aria-hidden="true">/</span> Live sessions
          </p>
          <h1 id={ids.title} className="lc-hero__title">
            The weekly lineup.
          </h1>
          <p className="lc-hero__range">
            <span>{monthLabel(startKey)}</span>
            <span className="lc-slash" aria-hidden="true">
              /
            </span>
            <span>{rangeLabel(startKey)}</span>
          </p>
        </div>
        <div className="lc-hero__actions">
          <div className="lc-weeknav" role="group" aria-label="Choose a week">
            <button type="button" className="lc-weeknav__step" onClick={() => setOffset((o) => o - 1)} aria-label="Go to previous week">
              <Icon name="chevron-left" size={20} />
            </button>
            <button
              type="button"
              className="lc-weeknav__now"
              onClick={() => setOffset(0)}
              aria-label={offset === 0 ? "Showing this week" : `Showing ${relativeWeekLabel(offset).toLowerCase()}. Back to this week`}
              aria-pressed={offset === 0}
            >
              {relativeWeekLabel(offset)}
            </button>
            <button type="button" className="lc-weeknav__step" onClick={() => setOffset((o) => o + 1)} aria-label="Go to next week">
              <Icon name="chevron-right" size={20} />
            </button>
          </div>
          {canManage ? (
            <button type="button" className="lc-btn lc-btn--add" onClick={() => setAdding(selected >= todayKey ? selected : dayKey(now, UK_ZONE))}>
              <Icon name="plus" size={16} /> Add call
            </button>
          ) : null}
        </div>
      </section>

      <p id={ids.status} className="lc-visually-hidden" role="status" aria-live="polite">
        {ready ? `${rangeLabel(startKey)}. ${callCount(week.total)}.` : ""}
      </p>

      <ol className="lc-days" aria-label="Days this week">
        {week.days.map((d) => {
          const isToday = d.key === todayKey;
          const count = d.calls.filter((c) => c.state !== "cancelled").length;
          return (
            <li key={d.key}>
              <button
                type="button"
                className={`lc-day${isToday ? " is-today" : ""}${d.key === selected ? " is-selected" : ""}`}
                aria-pressed={d.key === selected}
                aria-current={isToday ? "date" : undefined}
                aria-label={`${longDate(d.key)}${isToday ? ", today" : ""}, ${callCount(count)}`}
                onClick={() => pickDay(d.key)}
              >
                <span className="lc-day__name">{weekdayShort(d.key)}</span>
                <span className="lc-day__num">{dayOfMonth(d.key)}</span>
                <span className={`lc-day__dot${count ? " has-calls" : ""}`} />
              </button>
            </li>
          );
        })}
      </ol>

      <div className="lc-grid">
        <aside className="lc-side" aria-label="This week at a glance">
          <UpNext call={week.next} calls={calls} now={now} zone={zone} todayKey={todayKey} total={week.total} weekOver={weekOver} loading={!ready} />
          <dl className="lc-stats">
            <div className="lc-stat">
              <dt>Calls this week</dt>
              <dd>{ready ? pad2(week.total) : "--"}</dd>
            </div>
            <div className="lc-stat">
              <dt>Live now</dt>
              <dd className={week.liveNow ? "is-live" : undefined}>{ready ? pad2(week.liveNow) : "--"}</dd>
            </div>
          </dl>
          <p className="lc-zone">
            <Icon name="clock" size={15} />
            <span>
              {zone}
              <span className="lc-visually-hidden"> time zone. Times on this page are in this zone.</span>
            </span>
          </p>
        </aside>

        <section className="lc-agenda" aria-labelledby={ids.agenda} aria-busy={!ready}>
          <div className="lc-agenda__head">
            <h2 id={ids.agenda}>Week agenda</h2>
            <p>Monday – Sunday</p>
          </div>

          {query.isError && !query.data ? (
            <div className="lc-alert" role="alert">
              <p>{(query.error as { message?: string })?.message ?? "The live calls could not load."}</p>
              <button type="button" className="lc-btn" onClick={() => void query.refetch()}>
                Try again
              </button>
            </div>
          ) : null}

          {week.projected ? (
            <p className="lc-note">Weekly calls are shown at their usual time. The team confirms each one nearer the day.</p>
          ) : null}

          <ul className={`lc-rows${ready ? "" : " is-loading"}`} role="list">
            {week.days.map((d) => (
              <AgendaDay
                key={d.key}
                dayKey_={d.key}
                calls={d.calls}
                allCalls={calls}
                isToday={d.key === todayKey}
                open={open.has(d.key)}
                onToggle={() => toggle(d.key)}
                buttonRef={(el) => (el ? rowRefs.current.set(d.key, el) : rowRefs.current.delete(d.key))}
                zone={zone}
                now={now}
                ready={ready}
                onAdd={canManage && d.key >= todayKey ? () => setAdding(d.key) : undefined}
              />
            ))}
          </ul>
        </section>
      </div>

      <p className="lc-disclaimer">
        Live calls are general education. Nothing said on a call is personal financial advice, and the team cannot tell you what to buy or sell. Investing carries risk, and you can lose
        money.
      </p>

      {canManage ? <AddCallDialog openWithDate={adding} onClose={() => setAdding(null)} onScheduled={scheduled} /> : null}
    </div>
  );
}

function dayName(call: LiveCall, todayKey: string, zone: string) {
  const key = dayKey(Date.parse(call.startsAt), zone);
  if (key === todayKey) return "Today";
  if (key === addDays(todayKey, 1)) return "Tomorrow";
  return longDate(key);
}

function UpNext(props: { call: WeekCall | null; calls: LiveCall[]; now: number; zone: string; todayKey: string; total: number; weekOver: boolean; loading: boolean }) {
  const { call, now, zone } = props;
  const time = call ? timeRange(call, zone) : null;
  const state = call ? STATE[call.state] : null;
  return (
    <article className={`lc-next${call?.state === "live" ? " is-live" : ""}`} aria-live="polite">
      <img className="lc-next__art" src={desk} alt="" decoding="async" />
      <div className="lc-next__top">
        <span className="lc-next__label">
          <Icon name="broadcast" size={16} /> {call?.state === "live" ? "On now" : "Up next"}
        </span>
        <Icon name="video" size={20} className="lc-next__cam" />
      </div>
      {props.loading ? (
        <div className="lc-next__body">
          <span className="lc-skeleton lc-skeleton--title" />
          <span className="lc-skeleton" />
        </div>
      ) : call && time && state ? (
        <div className="lc-next__body">
          <h2 className="lc-next__title">{call.title}</h2>
          <p className="lc-next__when">
            {dayName(call, props.todayKey, zone)} · {time.range}
            {time.uk ? <span className="lc-next__uk"> ({time.uk})</span> : null}
          </p>
          {call.host ? <p className="lc-next__host">With {call.host}</p> : null}
          <div className="lc-next__actions">
            <span className={`lc-badge lc-badge--${state.tone}`}>
              {call.state === "live" ? <span className="lc-badge__dot" /> : null}
              {call.state === "upcoming" ? `Starts ${startsIn(call.startsAt, now)}` : state.label}
            </span>
            <JoinAction call={call} compact />
          </div>
        </div>
      ) : (
        <div className="lc-next__body">
          <h2 className="lc-next__title">{props.weekOver && props.total ? "That's a wrap." : "A quiet week."}</h2>
          <p className="lc-next__sub">{props.weekOver && props.total ? "Every call this week has finished." : "No upcoming calls this week."}</p>
          <Icon name="calendar" size={40} className="lc-next__cal" />
        </div>
      )}
    </article>
  );
}

function AgendaDay(props: {
  dayKey_: string;
  calls: WeekCall[];
  allCalls: LiveCall[];
  isToday: boolean;
  open: boolean;
  onToggle: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
  zone: string;
  now: number;
  ready: boolean;
  onAdd?: () => void;
}) {
  const panelId = useId();
  const headId = useId();
  const key = props.dayKey_;
  const count = props.calls.filter((c) => c.state !== "cancelled").length;
  return (
    <li className={`lc-row${props.open ? " is-open" : ""}${props.isToday ? " is-today" : ""}`}>
      <h3 className="lc-row__h">
        <button type="button" id={headId} ref={props.buttonRef} className="lc-row__btn" aria-expanded={props.open} aria-controls={panelId} onClick={props.onToggle}>
          <span className="lc-row__date">{dayOfMonth(key)}</span>
          <span className="lc-row__name">
            {weekdayLong(key)}
            {props.isToday ? <span className="lc-row__today">Today</span> : null}
          </span>
          <span className="lc-row__count">{props.ready ? callCount(count) : <span className="lc-skeleton lc-skeleton--count" />}</span>
          <Icon name="chevron-down" size={18} className="lc-row__chev" />
        </button>
      </h3>
      <div id={panelId} role="region" aria-labelledby={headId} className="lc-row__panel" hidden={!props.open}>
        {props.calls.length ? (
          <ul className="lc-calls" role="list">
            {props.calls.map((c) => (
              <CallItem key={`${c.callId}-${c.startsAt}`} call={c} all={props.allCalls} zone={props.zone} />
            ))}
          </ul>
        ) : (
          <p className="lc-row__empty">Nothing on this day.</p>
        )}
        {props.onAdd ? (
          <button type="button" className="lc-row__add" onClick={props.onAdd}>
            <Icon name="plus" size={15} /> Add a call on {weekdayLong(key)}
          </button>
        ) : null}
      </div>
    </li>
  );
}

function CallItem({ call, all, zone }: { call: WeekCall; all: LiveCall[]; zone: string }) {
  const { range, uk } = timeRange(call, zone);
  const state = STATE[call.state];
  return (
    <li className={`lc-call lc-call--${call.state}`}>
      <div className="lc-call__time">
        <span className="lc-call__clock">{range}</span>
        {uk ? <span className="lc-call__uk">{uk}</span> : null}
      </div>
      <div className="lc-call__body">
        <div className="lc-call__titlerow">
          <h4 className="lc-call__title">{call.title}</h4>
          <span className={`lc-badge lc-badge--${state.tone}`}>
            {call.state === "live" ? <span className="lc-badge__dot" /> : null}
            {state.label}
          </span>
          {call.repeats === "weekly" ? <span className="lc-badge lc-badge--outline">Weekly</span> : null}
        </div>
        {call.host ? <p className="lc-call__host">With {call.host}</p> : null}
        {call.description ? <p className="lc-call__text">{call.description}</p> : null}
      </div>
      <div className="lc-call__actions">
        <JoinAction call={call} />
        {isOpen(call) ? (
          <div className="lc-cluster">
            {!call.projected ? (
              <button type="button" className="lc-btn lc-btn--sm" onClick={() => downloadIcs(call, all, false)}>
                <Icon name="download" size={15} /> Add to calendar
              </button>
            ) : null}
            {call.repeats === "weekly" ? (
              <button type="button" className="lc-btn lc-btn--sm lc-btn--quiet" onClick={() => downloadIcs(call, all, true)}>
                Add every week
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function JoinAction({ call, compact }: { call: WeekCall; compact?: boolean }) {
  if (call.joinUrl)
    return (
      <a className="lc-btn lc-btn--primary lc-btn--sm" href={call.joinUrl} target="_blank" rel="noopener noreferrer">
        Join the call <Icon name="external" size={15} />
        <span className="lc-visually-hidden"> (opens in a new tab)</span>
      </a>
    );
  if (!isOpen(call) || compact) return null;
  return (
    <p className="lc-call__wait">
      {call.projected
        ? "The team confirms this call nearer the day."
        : call.hasJoinUrl
          ? "The join link appears here 15 minutes before the start."
          : "The team will add the join link before the start."}
    </p>
  );
}
