// Preview harness: the real LiveCallsPage inside a copy of the Impact Investment shell, with an in-memory server.
// Not shipped. Build: see README ("Preview").
import { StrictMode, useEffect, useState, useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { configureLiveCalls } from "../src/adapters";
import { LiveCallsPage } from "../src/LiveCallsPage";
import { UK_ZONE, addDays, dayKey, zonedTime, type CallState, type LiveCall } from "../src/week";
import type { NewCall } from "../src/AddCallDialog";

const params = new URLSearchParams(location.search);
// Frozen at the moment of the request (Sunday 25 October 2026, 13:52 UK) so the preview matches the photo.
const FROZEN = Date.parse(params.get("now") ?? "2026-10-25T13:52:00Z");
const realStart = Date.now();
const clock = () => FROZEN + (Date.now() - realStart);

// Preview controls: theme and staff/member view. The published preview cannot read the URL, so these are buttons.
const prefs = { staff: params.get("staff") !== "0", theme: params.get("theme") ?? "future" };
const listeners = new Set<() => void>();
const subscribe = (fn: () => void) => (listeners.add(fn), () => listeners.delete(fn));
function setPref<K extends keyof typeof prefs>(k: K, v: (typeof prefs)[K]) {
  Object.assign(prefs, { [k]: v });
  applyTheme();
  listeners.forEach((fn) => fn());
}
const themeRoot = document.getElementById("theme-root") ?? document.documentElement;
const themeAttr = themeRoot.dataset.themeAttr ?? "data-theme";
function applyTheme() {
  themeRoot.setAttribute(themeAttr, prefs.theme);
  themeRoot.setAttribute(themeAttr === "data-theme" ? "data-scheme" : "data-vt-scheme", prefs.theme === "future" || prefs.theme === "dark" ? "dark" : "light");
}
applyTheme();
const useStaff = () => useSyncExternalStore(subscribe, () => prefs.staff);
const useTheme = () => useSyncExternalStore(subscribe, () => prefs.theme);

interface Series extends NewCall {
  id: string;
  skipped: string[];
}
let nextId = 1;
const series: Series[] = [];
function add(c: Omit<NewCall, "description" | "host" | "endsOn" | "joinUrl"> & Partial<NewCall>) {
  series.push({ description: "", host: "", endsOn: null, joinUrl: null, ...c, id: `call_${nextId++}`, skipped: [] });
}
// This week: three calls Thursday to Saturday, already finished (as in the photo).
add({ title: "Markets Q&A", host: "Malachi", date: "2026-10-22", time: "18:00", durationMinutes: 60, repeats: "weekly", description: "Open questions on the markets pages and how to read them." });
add({ title: "Roadmap walkthrough: step 3", host: "VT Impact team", date: "2026-10-23", time: "19:00", durationMinutes: 45, repeats: "none", description: "Going through step 3 of the roadmap: building an emergency fund." });
add({ title: "Weekend review", host: "Malachi", date: "2026-10-24", time: "11:00", durationMinutes: 60, repeats: "weekly", description: "A look back at the week's lessons and your questions.", joinUrl: "https://meet.google.com/abc-defg-hij" });
// Next week.
add({ title: "Compound interest, explained", host: "VT Impact team", date: "2026-10-27", time: "18:30", durationMinutes: 60, repeats: "none", description: "Using the calculator to see how time and regular deposits change the outcome." });
add({ title: "Gold: how the market works", host: "Malachi", date: "2026-10-29", time: "20:00", durationMinutes: 45, repeats: "none", description: "General education on what moves gold. Not a recommendation to buy or sell." });

function occurrences(now: number, from: number, to: number): LiveCall[] {
  const out: LiveCall[] = [];
  for (const s of series) {
    const [h, m] = s.time.split(":").map(Number);
    const count = s.repeats === "weekly" ? 52 : 1;
    for (let i = 0; i < count; i++) {
      const day = addDays(s.date, i * 7);
      if (s.endsOn && day > s.endsOn) break;
      const start = zonedTime(day, h, m, UK_ZONE);
      if (start < from) continue;
      if (start >= to) break;
      const end = start + s.durationMinutes * 60_000;
      const iso = new Date(start).toISOString();
      const cancelled = s.skipped.includes(iso);
      const state: CallState = cancelled ? "cancelled" : now >= end ? "ended" : now >= start ? "live" : start - now <= 15 * 60_000 ? "soon" : "upcoming";
      const joinable = !!s.joinUrl && (state === "live" || state === "soon");
      out.push({ callId: s.id, title: s.title, description: s.description || null, host: s.host || null, startsAt: iso, endsAt: new Date(end).toISOString(), state, repeats: s.repeats, joinUrl: joinable ? s.joinUrl : null, hasJoinUrl: !!s.joinUrl });
    }
  }
  return out.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt));
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

configureLiveCalls({
  // Answers the week asked for (from/to), as the README suggests the real endpoint should. Add ?window=1 to the
  // preview URL to mimic a server that ignores from/to and sends a fixed window instead (the page then projects
  // weekly calls into later weeks).
  async get<T>(_path: string, opts?: { query?: Record<string, string | number | undefined> }): Promise<T> {
    await wait(250);
    const now = clock();
    const q = opts?.query ?? {};
    const fixed = params.get("window") === "1" || !q.from || !q.to;
    const [from, to] = fixed ? [now - 7 * 864e5, now + 21 * 864e5] : [Date.parse(String(q.from)), Date.parse(String(q.to))];
    return { calls: occurrences(now, from, to) } as T;
  },
  async post<T>(_path: string, body: unknown): Promise<T> {
    await wait(500);
    const c = body as NewCall;
    if (/test-error/i.test(c.title)) throw { message: "Check the highlighted fields.", fields: { title: "The server rejected this title (preview test)." } };
    add(c);
    return {} as T;
  },
  useCanManage: useStaff,
  useNow: function useNow() {
    const [n, set] = useState(clock);
    useEffect(() => {
      const id = setInterval(() => set(clock()), 1000);
      return () => clearInterval(id);
    }, []);
    return n;
  },
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

const I = (d: string) => (
  <svg className="inv-menu__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const menu = [
  { label: "Learn", links: [["Overview", "M3 10.5L12 3l9 7.5V21h-6v-6H9v6H3z"], ["Roadmap", "M5 21V4h11l-2 4 2 4H5"], ["Markets", "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z"], ["Tools", "M4 7h10M18 7h2M4 17h4M12 17h8M14 4v6M8 14v6"]] },
  { label: "Live", links: [["Live calls", "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2"]] },
  { label: "Support", links: [["Ask the team", "M12 22a10 10 0 100-20 10 10 0 000 20zM9.1 9a3 3 0 015.8 1c0 2-3 3-3 3M12 17h.01"], ["Book a call", "M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"]] },
];

function PreviewBar() {
  const staff = useStaff();
  const theme = useTheme();
  return (
    <div className="pv-bar" role="group" aria-label="Preview settings">
      <span className="pv-bar__label">Preview</span>
      <div className="pv-seg">
        {(["future", "light"] as const).map((t) => (
          <button key={t} type="button" aria-pressed={theme === t} onClick={() => setPref("theme", t)}>
            {t === "future" ? "Future theme" : "Light theme"}
          </button>
        ))}
      </div>
      <div className="pv-seg">
        <button type="button" aria-pressed={staff} onClick={() => setPref("staff", true)}>Staff view</button>
        <button type="button" aria-pressed={!staff} onClick={() => setPref("staff", false)}>Member view</button>
      </div>
    </div>
  );
}

function Shell() {
  return (
    <div className="inv" data-menu="on">
      <header className="inv__header">
        <a className="inv-brand" href="#">
          Impact <span>Investment</span>
        </a>
        <nav aria-label="Other portals" className="inv__out">
          <a href="#">← All portals</a>
          <a href="#">Enterprise</a>
        </nav>
        <span className="inv-avatar" aria-label="Malachi">
          M
        </span>
      </header>
      <div className="inv__body">
        <aside className="inv__side">
          <nav aria-label="Impact Investment" className="inv-menu">
            {menu.map((g) => (
              <div className="inv-menu__group" key={g.label}>
                <p className="inv-menu__heading">{g.label}</p>
                <ul role="list">
                  {g.links.map(([label, d]) => (
                    <li key={label}>
                      <a href="#" className={`inv-menu__link${label === "Live calls" ? " active" : ""}`} aria-current={label === "Live calls" ? "page" : undefined}>
                        {I(d)}
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </aside>
        <main id="main" tabIndex={-1} className="inv__main">
          <LiveCallsPage />
        </main>
      </div>
      <PreviewBar />
    </div>
  );
}

const qc = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <Shell />
    </QueryClientProvider>
  </StrictMode>,
);
// Keeps dayKey in the bundle for console poking: window.dayKey(Date.now(), "Europe/London").
Object.assign(window, { dayKey });
