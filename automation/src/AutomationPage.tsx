// /automation: Instant Impact (paid signals) and The Sniper Bot (copy trading) on one page.
import { useAutomationState, usePageMeta } from "./api";
import { InstantImpactSection } from "./InstantImpactSection";
import { SniperBotSection } from "./SniperBotSection";
import { AUTOMATION_SEO } from "./seo";
import "./automation.css";

export function AutomationPage() {
  usePageMeta(AUTOMATION_SEO.automation.title, AUTOMATION_SEO.automation.description);
  const { state, error, reload } = useAutomationState();
  const cancelled = typeof location !== "undefined" && new URLSearchParams(location.search).get("checkout") === "cancelled";

  return (
    <main className="aut" id="main">
      <header className="aut-hero">
        <span className="aut-eyebrow">Automation</span>
        <h1 className="aut-hero__title">
          Let the <span className="aut-grad">trades come to you</span>
        </h1>
        <p className="aut-hero__lead">Two ways to automate with VT Impact: get our signals instantly, or copy our bot straight onto your account.</p>
        <nav className="aut-jump" aria-label="On this page">
          <a href="#instant-impact">Instant Impact</a>
          <a href="#sniper-bot">The Sniper Bot</a>
        </nav>
      </header>

      {cancelled ? (
        <p className="aut-status aut-banner" role="status">
          Checkout was cancelled and you haven't been charged. You can subscribe whenever you're ready.
        </p>
      ) : null}
      {error ? (
        <p className="aut-status aut-status--warn aut-banner" role="alert">
          We couldn't load your subscription just now.{" "}
          <button type="button" className="aut-linkbtn" onClick={reload}>
            Try again
          </button>
        </p>
      ) : null}

      <div className="aut-sections">
        <InstantImpactSection state={state} reload={reload} />
        <SniperBotSection state={state} />
      </div>
    </main>
  );
}

export default AutomationPage;
