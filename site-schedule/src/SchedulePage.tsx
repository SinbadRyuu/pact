// vtimpact.com/schedule: the weekly lineup on its own page, outside the Impact Investment portal.
//
// Same page, data and Add call (for staff) as /investment/calls, with a slim header back to the landing page
// instead of the portal's sidebar. Signed-out visitors go to sign-in and come straight back here afterwards.
import { Link, Navigate, useLocation } from "react-router-dom";
import { scheduleShellDeps } from "./adapters";
import { LiveCallsPage } from "./live-calls";
import "./schedule.css";

export function SchedulePage() {
  const { useSession, Logo, riskLine } = scheduleShellDeps();
  const session = useSession();
  const location = useLocation();
  const state = session.data?.state;

  if (session.isPending) {
    return (
      <div className="ss-page ss-page--status" role="status" aria-live="polite">
        <span className="ss-spinner" aria-hidden="true" />
        Checking your session
      </div>
    );
  }
  if (state !== "signed_in") {
    const next = encodeURIComponent(`${location.pathname}${location.search}${location.hash}`);
    return <Navigate replace to={`${state === "mfa_required" ? "/sign-in/verify" : "/sign-in"}?next=${next}`} />;
  }

  return (
    <div className="ss-page">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="ss-head">
        <Link className="ss-head__brand" to="/" aria-label="VT Impact home">
          <Logo inverse />
        </Link>
        <nav className="ss-head__nav" aria-label="Elsewhere on VT Impact">
          <Link to="/">
            <span aria-hidden="true">←</span> All portals
          </Link>
          {/* The investment portal is its own app, so this is a full page load like the landing page's tile. */}
          <a href="/investment">Impact Investment</a>
        </nav>
      </header>
      <main id="main" tabIndex={-1} className="ss-main">
        <LiveCallsPage />
      </main>
      {riskLine ? (
        <footer className="ss-foot">
          <p>{riskLine}</p>
        </footer>
      ) : null}
    </div>
  );
}

/** For the router's `lazy`: `{ path: "schedule", lazy: () => import("./schedule/SchedulePage").then((m) => ({ Component: m.Component })) }` */
export const Component = SchedulePage;
