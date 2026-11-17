// /automation/subscribe: where sign-up / sign-in sends people back to. Signed in → straight to Stripe Checkout.
// Signed out (e.g. someone opened the link directly) → sign-up, then back here.
import { useEffect, useRef, useState } from "react";
import { automationDeps } from "./adapters";
import { signUpHref, startCheckout, usePageMeta } from "./api";
import { AUTOMATION_SEO } from "./seo";
import "./automation.css";

export function SubscribePage() {
  usePageMeta(AUTOMATION_SEO.subscribe.title, AUTOMATION_SEO.subscribe.description);
  const session = automationDeps().useSession();
  const [error, setError] = useState(false);
  const started = useRef(false);

  useEffect(() => {
    if (session.isPending || started.current) return;
    started.current = true;
    if (session.data?.state !== "signed_in") {
      window.location.replace(signUpHref("/automation/subscribe"));
      return;
    }
    startCheckout().catch(() => setError(true));
  }, [session.isPending, session.data?.state]);

  return (
    <main className="aut aut--center" id="main">
      <div className="aut-card aut-card--narrow" aria-live="polite">
        {error ? (
          <>
            <h1 className="aut-card__title">We couldn't open checkout</h1>
            <p className="aut-card__lead">Nothing has been charged. Please try again.</p>
            <a className="aut-btn aut-btn--primary" href="/automation#instant-impact">
              Back to Instant Impact
            </a>
          </>
        ) : (
          <>
            <span className="aut-spinner" aria-hidden="true" />
            <h1 className="aut-card__title">Taking you to secure checkout…</h1>
            <p className="aut-card__lead">Payments are handled by Stripe. You can cancel any time.</p>
          </>
        )}
      </div>
    </main>
  );
}

export default SubscribePage;
