// Integration preview: the new pages inside a copy of the app frame, wired exactly as the READMEs describe.
import { StrictMode, useEffect, useState, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { configureAutomation } from "../../automation/src/adapters";
import { AutomationSections } from "../../automation/src/AutomationSections";
import { SubscribePage } from "../../automation/src/SubscribePage";
import { SuccessPage } from "../../automation/src/SuccessPage";
import { configureIndicators } from "../../indicators-page/src/adapters";
import { IndicatorDetailPage } from "../../indicators-page/src/IndicatorDetailPage";
import { IndicatorsSection } from "../../indicators-page/src/IndicatorsPage";
import { configureRankings } from "../../power-rankings/src/adapters";
import { SignalsTabs } from "../../power-rankings/src/parts";
import { ProviderPage } from "../../power-rankings/src/ProviderPage";
import { RankingsSection } from "../../power-rankings/src/RankingsPage";
import { NewNavLinks } from "../../site-navigation/src/NavLinks";
import {
  AppHeader,
  AutomationHeader,
  BottomNav,
  ExistingIndicators,
  IndicatorsHeader,
  SIGNALS_TABS,
  SignalsHeader,
  StrategiesBody,
} from "./existing";
import { installMockFetch, mockFetch } from "./mockApi";
import { currentPage, navigate, persona, PERSONAS, previewUrl } from "./nav";
import "./shell.css";

installMockFetch();

/** Router link for all three modules: stays inside the preview. */
function PreviewLink(props: { to: string; className?: string; children: ReactNode; "aria-label"?: string; "aria-current"?: "page" }) {
  const href = previewUrl(props.to);
  return (
    <a
      href={href}
      className={props.className}
      aria-label={props["aria-label"]}
      aria-current={props["aria-current"]}
      onClick={(e) => {
        e.preventDefault();
        navigate(href);
      }}
    >
      {props.children}
    </a>
  );
}

const useSession = () => ({ isPending: false, data: { state: persona() === "visitor" ? "signed_out" : "signed_in" } });
const signIn = (next: string) => previewUrl("/sign-in", { next });
configureAutomation({ useSession, signInHref: signIn, signUpHref: signIn, Link: PreviewLink as never });
configureIndicators({ signInHref: signIn, Link: PreviewLink });
configureRankings({ Link: PreviewLink, signalsTabs: SIGNALS_TABS });

// Plain <a href="/…"> links inside the modules (e.g. "Back to Instant Impact") also stay in the preview, and the
// CSV export link is served by the in-browser API.
document.addEventListener("click", async (e) => {
  const a = (e.target as HTMLElement).closest?.("a");
  const href = a?.getAttribute("href");
  if (!a || !href || e.defaultPrevented) return;
  if (href.startsWith("/api/")) {
    e.preventDefault();
    const res = await mockFetch(href);
    if (!res) return;
    const url = URL.createObjectURL(await res.blob());
    const tmp = Object.assign(document.createElement("a"), { href: url, download: a.getAttribute("download") || "export.csv" });
    tmp.click();
    URL.revokeObjectURL(url);
  } else if (href.startsWith("/")) {
    e.preventDefault();
    navigate(previewUrl(href));
  }
});

function Page({ page }: { page: string }) {
  const q = new URLSearchParams(location.search);
  let m: RegExpExecArray | null;

  if (page === "/automation")
    return (
      <>
        <AutomationHeader />
        <div className="is-new">
          <AutomationSections strategies={<StrategiesBody />} hasStrategies={false} />
        </div>
      </>
    );
  if (page === "/automation/subscribe") return <SubscribePage />;
  if (page === "/automation/success") return <SuccessPage />;
  if (page === "/indicators")
    return (
      <>
        <IndicatorsHeader />
        {q.get("downloaded") ? <p className="x-toast">Preview: the download or TradingView page would open here, and the count goes up by one.</p> : null}
        <div className="is-new">
          <IndicatorsSection />
        </div>
        <ExistingIndicators />
      </>
    );
  if ((m = /^\/indicators\/([^/]+)$/.exec(page))) return <IndicatorDetailPage slug={decodeURIComponent(m[1])} />;
  if (page === "/signals/rankings")
    return (
      <>
        <SignalsHeader />
        <div className="is-new">
          <SignalsTabs current="rankings" />
          <RankingsSection />
        </div>
      </>
    );
  if ((m = /^\/signals\/providers\/([^/]+)$/.exec(page))) return <ProviderPage slug={decodeURIComponent(m[1])} />;
  if (page === "/more")
    return (
      <div className="x-sheet">
        <h1 className="x-h2">More</h1>
        <p className="x-lead">The three new pages, as they'd appear in the More menu (and the desktop nav).</p>
        <div className="x-sheet__list is-new">
          <NewNavLinks pathname={page} Link={PreviewLink} />
        </div>
        <p className="x-note">Your existing More items stay as they are, above or below these.</p>
      </div>
    );
  if (page === "/sign-in")
    return (
      <div className="x-sheet">
        <h1 className="x-h2">Sign in</h1>
        <p className="x-lead">Your existing sign-in page. After signing in it sends people to:</p>
        <p className="x-code">{q.get("next")}</p>
        <a className="x-gradbtn" href={previewUrl(q.get("next") || "/automation", { as: "member" })} onClick={(e) => (e.preventDefault(), navigate(previewUrl(q.get("next") || "/automation", { as: "member" })))}>
          Sign in (preview)
        </a>
      </div>
    );
  if (page === "/stripe-portal")
    return (
      <div className="x-sheet">
        <h1 className="x-h2">Stripe Customer Portal</h1>
        <p className="x-lead">Stripe's own page opens here: cancel, change card, download invoices. It sends people back to /automation afterwards.</p>
        <a className="x-gradbtn" href={previewUrl("/automation#instant-impact")}>
          Back to Automation
        </a>
      </div>
    );
  return (
    <div className="x-sheet">
      <h1 className="x-h2">Existing page</h1>
      <p className="x-lead">This part of the app doesn't change. Use the bar at the top to look at the new pages.</p>
    </div>
  );
}

const PAGES = [
  ["/automation", "Automation"],
  ["/indicators", "Indicators"],
  ["/indicators/vt-structure", "Indicator detail"],
  ["/signals/rankings", "Power Rankings"],
  ["/signals/providers/aurum", "Provider profile"],
  ["/more", "More menu"],
];

function Controls({ page }: { page: string }) {
  const [highlight, setHighlight] = useState(false);
  useEffect(() => {
    document.body.classList.toggle("show-new", highlight);
  }, [highlight]);
  return (
    <div className="pv-bar">
      <label>
        Page
        <select value={PAGES.some(([p]) => p === page) ? page : ""} onChange={(e) => navigate(previewUrl(e.target.value))}>
          <option value="" disabled>
            …
          </option>
          {PAGES.map(([p, l]) => (
            <option key={p} value={p}>
              {l}
            </option>
          ))}
        </select>
      </label>
      <label>
        Viewing as
        <select value={persona()} onChange={(e) => (location.href = previewUrl(`${page}${location.hash}`, { as: e.target.value }))}>
          {PERSONAS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <label className="pv-check">
        <input type="checkbox" checked={highlight} onChange={(e) => setHighlight(e.target.checked)} /> Outline new parts
      </label>
    </div>
  );
}

function App() {
  const [page, setPage] = useState(currentPage());
  useEffect(() => {
    const sync = () => setPage(currentPage());
    addEventListener("preview:navigate", sync);
    addEventListener("popstate", sync);
    return () => {
      removeEventListener("preview:navigate", sync);
      removeEventListener("popstate", sync);
    };
  }, []);
  return (
    <>
      <Controls page={page} />
      <div className="app">
        <AppHeader />
        <main className="app-main" key={`${page}|${persona()}`}>
          <Page page={page} />
        </main>
        <BottomNav current={page} go={(p) => navigate(previewUrl(p === "/signals/rankings" ? "/signals/rankings" : p))} />
      </div>
    </>
  );
}

if (new URLSearchParams(location.search).get("shot")) document.body.classList.add("shot");
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
