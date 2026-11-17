// /automation/success?session_id=…: Stripe sends people here after paying.
// Confirms the session on the server (so access is instant even if the webhook is a few seconds behind),
// then shows how to get the signals. The Telegram link only comes back once the server confirms access.
import { useEffect, useState } from "react";
import { api, usePageMeta } from "./api";
import { RiskWarning } from "./RiskWarning";
import { AUTOMATION_SEO } from "./seo";
import "./automation.css";

interface Confirm {
  ok: boolean;
  hasAccess: boolean;
  status: string | null;
  telegramLink: string | null;
}

export function SuccessPage() {
  usePageMeta(AUTOMATION_SEO.success.title, AUTOMATION_SEO.success.description);
  const [result, setResult] = useState<Confirm | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id") ?? "";
    let tries = 0;
    let timer: ReturnType<typeof setTimeout>;
    const check = () => {
      api<Confirm>("GET", `/checkout/confirm?session_id=${encodeURIComponent(sessionId)}`)
        .then((r) => {
          // Card payments that need 3-D Secure can take a moment to settle; keep checking briefly.
          if (!r.hasAccess && tries++ < 5) timer = setTimeout(check, 2000);
          else setResult(r);
        })
        .catch(() => setFailed(true));
    };
    check();
    return () => clearTimeout(timer);
  }, []);

  return (
    <main className="aut aut--center" id="main">
      <div className="aut-card aut-card--narrow" aria-live="polite">
        {!result && !failed ? (
          <>
            <span className="aut-spinner" aria-hidden="true" />
            <h1 className="aut-card__title">Confirming your payment…</h1>
          </>
        ) : result?.hasAccess ? (
          <>
            <span className="aut-eyebrow">Payment confirmed</span>
            <h1 className="aut-card__title">Welcome to Instant Impact</h1>
            <p className="aut-card__lead">Your subscription is active. Here's how to get your signals:</p>
            <ol className="aut-steps aut-steps--compact">
              {result.telegramLink ? (
                <li className="aut-step">
                  <span className="aut-step__num" aria-hidden="true">
                    1
                  </span>
                  <div className="aut-step__body">
                    <h2>Join the private Telegram channel</h2>
                    <p>Turn notifications on so you see each signal the second it's posted.</p>
                    <a className="aut-btn aut-btn--primary aut-btn--glow" href={result.telegramLink} target="_blank" rel="noopener noreferrer">
                      Join on Telegram
                    </a>
                  </div>
                </li>
              ) : null}
              <li className="aut-step">
                <span className="aut-step__num" aria-hidden="true">
                  {result.telegramLink ? 2 : 1}
                </span>
                <div className="aut-step__body">
                  <h2>Or see them on the site</h2>
                  <p>Every signal is live on the Automation page while you're signed in.</p>
                  <a className="aut-btn aut-btn--ghost" href="/automation#instant-impact">
                    View the signals
                  </a>
                </div>
              </li>
              <li className="aut-step">
                <span className="aut-step__num" aria-hidden="true">
                  {result.telegramLink ? 3 : 2}
                </span>
                <div className="aut-step__body">
                  <h2>Manage it any time</h2>
                  <p>Cancel or change your card from "Manage subscription" on the Automation page. A receipt is on its way by email.</p>
                </div>
              </li>
            </ol>
            <RiskWarning />
          </>
        ) : (
          <>
            <h1 className="aut-card__title">We're still confirming your payment</h1>
            <p className="aut-card__lead">
              This usually takes a few seconds. If you were charged, your access will switch on automatically. Refresh this page in a
              minute, or contact support if it doesn't.
            </p>
            <a className="aut-btn aut-btn--ghost" href="/automation#instant-impact">
              Back to Instant Impact
            </a>
          </>
        )}
      </div>
    </main>
  );
}

export default SuccessPage;
