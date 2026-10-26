// Preview harness: a copy of the vtimpact.com landing page with the new schedule button, the stand-alone /schedule
// page, and a stand-in sign-in page, over an in-memory server. Not shipped. Build: `node build-preview.mjs`.
import { StrictMode, useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Link, Route, Routes, useNavigate, useSearchParams } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ScheduleButton } from "../src/ScheduleButton";
import { SchedulePage } from "../src/SchedulePage";
import { configureScheduleShell } from "../src/adapters";
import { configureLiveCalls } from "../src/live-calls";
import { UK_ZONE, addDays, dayKey, weekStartKey, zonedTime, type CallState, type LiveCall } from "../../investment-live-calls/src/week";
import logoHtml from "./logo.html";
import backdropHtml from "./backdrop.html";

const RISK = "Trading involves risk, and you can lose money. Historical or simulated performance does not guarantee future results.";

// ---------- Preview state: signed in or out, staff or member ----------
const prefs = { signedIn: true, staff: true };
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));
function setPref<K extends keyof typeof prefs>(k: K, v: (typeof prefs)[K]) {
  Object.assign(prefs, { [k]: v });
  listeners.forEach((fn) => fn());
}
const useSignedIn = () => useSyncExternalStore(subscribe, () => prefs.signedIn);
const useStaff = () => useSyncExternalStore(subscribe, () => prefs.staff);

// ---------- In-memory calls, placed in the current week so the preview always has something on ----------
interface Series {
  title: string;
  host: string;
  description: string;
  weekday: number; // 0 = Monday
  time: string;
  minutes: number;
  repeats: "none" | "weekly";
  joinUrl: string | null;
}
const thisMonday = weekStartKey(dayKey(Date.now(), UK_ZONE));
const series: Series[] = [
  { title: "Markets Q&A", host: "Malachi", weekday: 1, time: "18:00", minutes: 60, repeats: "weekly", description: "Open questions on the markets pages and how to read them.", joinUrl: "https://meet.google.com/abc-defg-hij" },
  { title: "Compound interest, explained", host: "VT Impact team", weekday: 2, time: "18:30", minutes: 60, repeats: "none", description: "Using the calculator to see how time and regular deposits change the outcome.", joinUrl: null },
  { title: "Gold: how the market works", host: "Malachi", weekday: 3, time: "20:00", minutes: 45, repeats: "none", description: "General education on what moves gold. Not a recommendation to buy or sell.", joinUrl: null },
  { title: "Weekend review", host: "Malachi", weekday: 5, time: "11:00", minutes: 60, repeats: "weekly", description: "A look back at the week's lessons and your questions.", joinUrl: "https://meet.google.com/abc-defg-hij" },
];
let extra: LiveCall[] = [];

function occurrences(now: number, from: number, to: number): LiveCall[] {
  const out: LiveCall[] = [...extra.filter((c) => Date.parse(c.startsAt) >= from && Date.parse(c.startsAt) < to)];
  series.forEach((s, i) => {
    const [h, m] = s.time.split(":").map(Number);
    for (let w = -1; w < (s.repeats === "weekly" ? 26 : 1); w++) {
      if (s.repeats === "none" && w !== 0) continue;
      const start = zonedTime(addDays(thisMonday, s.weekday + w * 7), h, m, UK_ZONE);
      if (start < from || start >= to) continue;
      const end = start + s.minutes * 60_000;
      const state: CallState = now >= end ? "ended" : now >= start ? "live" : start - now <= 15 * 60_000 ? "soon" : "upcoming";
      out.push({
        callId: `call_${i}`,
        title: s.title,
        description: s.description,
        host: s.host,
        startsAt: new Date(start).toISOString(),
        endsAt: new Date(end).toISOString(),
        state,
        repeats: s.repeats,
        joinUrl: s.joinUrl && (state === "live" || state === "soon") ? s.joinUrl : null,
        hasJoinUrl: !!s.joinUrl,
      });
    }
  });
  return out.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

configureLiveCalls({
  async get<T>(_path: string, opts?: { query?: Record<string, string | number | undefined> }): Promise<T> {
    await wait(200);
    const q = opts?.query ?? {};
    return { calls: occurrences(Date.now(), Date.parse(String(q.from)), Date.parse(String(q.to))) } as T;
  },
  async post<T>(_path: string, body: unknown): Promise<T> {
    await wait(400);
    const c = body as { title: string; date: string; time: string; durationMinutes: number; host?: string; description?: string; repeats: "none" | "weekly" };
    const [h, m] = c.time.split(":").map(Number);
    const start = zonedTime(c.date, h, m, UK_ZONE);
    extra = [...extra, { callId: `new_${extra.length}`, title: c.title, description: c.description || null, host: c.host || null, startsAt: new Date(start).toISOString(), endsAt: new Date(start + c.durationMinutes * 60_000).toISOString(), state: "upcoming", repeats: c.repeats, joinUrl: null, hasJoinUrl: false }];
    return {} as T;
  },
  useCanManage: useStaff,
  usePageTitle: (t) => {
    document.title = `${t} · VT Impact`;
  },
  notify: (m) => {
    const el = document.getElementById("toast")!;
    el.textContent = m;
    el.dataset.on = "1";
    setTimeout(() => (el.dataset.on = "0"), 2600);
  },
});

function Logo() {
  return <span style={{ display: "contents" }} dangerouslySetInnerHTML={{ __html: logoHtml }} />;
}

configureScheduleShell({
  useSession: function useSession() {
    const signedIn = useSignedIn();
    const [pending, setPending] = useState(true);
    useEffect(() => {
      const id = setTimeout(() => setPending(false), 250);
      return () => clearTimeout(id);
    }, []);
    return { isPending: pending, data: { state: signedIn ? "signed_in" : "signed_out" } };
  },
  Logo,
  riskLine: RISK,
});

// ---------- The landing page, as vtimpact.com renders it, with the new card in place ----------
const arrow = (
  <svg className="icon portal__enter-arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);
const tileIcon = (d: string) => (
  <svg className="icon portal__tile-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);

function Landing() {
  const signedIn = useSignedIn();
  useEffect(() => {
    document.title = "VT Impact";
  }, []);
  return (
    <>
      <div dangerouslySetInnerHTML={{ __html: backdropHtml }} style={{ display: "contents" }} />
      <div className="portal">
        <main id="main" tabIndex={-1} className="portal__main">
          <section className="portal__enterprise" aria-labelledby="enterprise-title">
            <p className="portal__eyebrow" id="enterprise-title">Impact Enterprise</p>
            <h1 className="portal__title">
              <Logo />
            </h1>
            <p className="portal__lead">Gold signals, charts and the community, in one place.</p>
            <a className="portal__enter" href="#/">
              Enter portal{arrow}
            </a>
            <p className="portal__aside">{signedIn ? "Signed in as Malachi" : <>New here? <a href="#/">Create an account</a></>}</p>
          </section>
          {/* ↓ The new card */}
          <ScheduleButton />
          {/* ↑ */}
          <div className="portal__more">
            <section className="portal__tile">
              {tileIcon("M4 6c0-1.7 3.6-3 8-3s8 1.3 8 3-3.6 3-8 3-8-1.3-8-3zM4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6")}
              <h2 className="portal__tile-title">Impact Investment</h2>
              <p className="portal__tile-text">Money basics, markets and live calls. Education only.</p>
              <a className="portal__tile-enter" href="#/">Enter portal{arrow}</a>
            </section>
            <section className="portal__tile">
              {tileIcon("M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM16 11l2 2 4-4")}
              <h2 className="portal__tile-title">Impact Affiliates</h2>
              <p className="portal__tile-text">Share your link and track who joins with it.</p>
              <a className="portal__tile-enter" href="#/">Enter portal{arrow}</a>
            </section>
            <section className="portal__tile">
              {tileIcon("M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z")}
              <h2 className="portal__tile-title">Impact Travel</h2>
              <p className="portal__tile-text">Coming soon.</p>
              <button type="button" className="portal__tile-enter" disabled>Enter portal</button>
            </section>
          </div>
        </main>
        <footer className="portal__footer">
          <p>{RISK}</p>
        </footer>
      </div>
    </>
  );
}

/** Stand-in for /sign-in: shows the `next` it was given and sends you back there once "signed in". */
function SignInStandIn() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const next = params.get("next") ?? "/";
  return (
    <div className="auth-frame">
      <main className="auth-frame__main container" id="main">
        <div className="auth-card stack">
          <h1>Sign in</h1>
          <p className="muted">Preview stand-in for the real sign-in page. Afterwards it returns you to <code>{next}</code>.</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => {
              setPref("signedIn", true);
              navigate(next, { replace: true });
            }}
          >
            Sign in
          </button>
          <p>
            <Link to="/">Back to the landing page</Link>
          </p>
        </div>
      </main>
    </div>
  );
}

function PreviewBar() {
  const signedIn = useSignedIn();
  const staff = useStaff();
  return (
    <div className="pv-bar" role="group" aria-label="Preview settings">
      <span className="pv-bar__label">Preview</span>
      <div className="pv-seg">
        <a href="#/">Landing</a>
        <a href="#/schedule">/schedule</a>
      </div>
      <div className="pv-seg">
        <button type="button" aria-pressed={signedIn} onClick={() => setPref("signedIn", true)}>Signed in</button>
        <button type="button" aria-pressed={!signedIn} onClick={() => setPref("signedIn", false)}>Signed out</button>
      </div>
      <div className="pv-seg">
        <button type="button" aria-pressed={staff} onClick={() => setPref("staff", true)}>Staff</button>
        <button type="button" aria-pressed={!staff} onClick={() => setPref("staff", false)}>Member</button>
      </div>
    </div>
  );
}

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <HashRouter>
        <Routes>
          <Route index element={<Landing />} />
          <Route path="schedule" element={<SchedulePage />} />
          <Route path="sign-in" element={<SignInStandIn />} />
          <Route path="sign-in/verify" element={<SignInStandIn />} />
        </Routes>
        <PreviewBar />
      </HashRouter>
    </QueryClientProvider>
  </StrictMode>,
);
