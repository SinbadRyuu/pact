// Section A: Instant Impact, automated signals behind a $9.99/month subscription.
// What people see depends on what the SERVER says (/state and /signals). Non-subscribers get placeholder cards,
// never real prices, so there's nothing to un-blur in dev tools.
import { useEffect, useState } from "react";
import { api, type AutomationState, type FeedSignal, openPortal, startCheckout } from "./api";
import { formatDate, formatEntry, formatPrice, STATUS_LABEL, timeAgo } from "./format";
import { PanelHead } from "./PanelHead";
import { RiskWarning } from "./RiskWarning";

const FEATURES = [
  "Every signal the moment it's posted: entry, stop loss and up to six take profits",
  "Targets and stop updates as the trade plays out",
  "Private Telegram channel with instant alerts",
  "Cancel any time in two taps",
];

export function InstantImpactSection({ state, reload }: { state: AutomationState | null; reload: () => void }) {
  const [feed, setFeed] = useState<{ locked: boolean; signals: FeedSignal[] } | null>(null);
  const [busy, setBusy] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!state) return;
    api<{ locked: boolean; signals: FeedSignal[] }>("GET", "/signals")
      .then(setFeed)
      .catch(() => setFeed({ locked: true, signals: [] }));
  }, [state?.hasAccess, state?.signedIn]);

  const go = async (kind: "checkout" | "portal") => {
    setBusy(kind);
    setError(null);
    try {
      await (kind === "checkout" ? startCheckout() : openPortal());
    } catch {
      setError("Something went wrong. Please try again in a moment.");
      setBusy(null);
      reload();
    }
  };

  const sub = state?.subscription;
  const price = state?.priceLabel ?? "$9.99/month";
  const paymentFailed = sub && (sub.status === "past_due" || sub.status === "unpaid") && !state?.hasAccess;
  const cancelled = sub?.status === "cancelled";

  return (
    <section id="instant-impact" className="aut-card aut-card--instant" aria-labelledby="ii-title">
      <PanelHead
        id="ii-title"
        title="Instant Impact"
        help={
          <p>
            A monthly subscription that sends every VT Impact signal to you the moment it's posted, with entry, stop loss and targets.
            Cancel any time from "Manage subscription". Payments are handled by Stripe.
          </p>
        }
      />
      <p className="aut-card__lead">
        Our signals, delivered automatically to your phone the second they're posted. No waiting for the group to catch up.
      </p>

      <div className="aut-instant">
        <div className="aut-instant__offer">
          <p className="aut-price">
            <span className="aut-price__amount">{price.split("/")[0]}</span>
            <span className="aut-price__per">/{price.split("/")[1] ?? "month"}</span>
          </p>
          <ul className="aut-ticks">
            {FEATURES.map((f) => (
              <li key={f}>{f}</li>
            ))}
          </ul>

          {state?.hasAccess && sub ? (
            <div className="aut-status aut-status--ok" role="status">
              <strong>You're subscribed.</strong>{" "}
              {sub.currentPeriodEnd &&
                (sub.cancelAtPeriodEnd
                  ? `Access ends ${formatDate(sub.currentPeriodEnd)}.`
                  : `Renews ${formatDate(sub.currentPeriodEnd)}.`)}
            </div>
          ) : null}
          {paymentFailed ? (
            <div className="aut-status aut-status--warn" role="alert">
              <strong>Your last payment didn't go through.</strong> Update your card to get the signals back.
            </div>
          ) : null}
          {cancelled && !state?.hasAccess ? (
            <div className="aut-status" role="status">
              Your subscription has ended. You can restart it any time.
            </div>
          ) : null}

          <div className="aut-actions">
            {state?.hasAccess ? (
              <>
                {state.telegramLink ? (
                  <a className="aut-btn aut-btn--primary" href={state.telegramLink} target="_blank" rel="noopener noreferrer">
                    Open the Telegram channel
                  </a>
                ) : null}
                <button className="aut-btn aut-btn--ghost" type="button" onClick={() => go("portal")} disabled={busy !== null}>
                  {busy === "portal" ? "Opening…" : "Manage subscription"}
                </button>
              </>
            ) : paymentFailed && state?.canManage ? (
              <button className="aut-btn aut-btn--primary" type="button" onClick={() => go("portal")} disabled={busy !== null}>
                {busy === "portal" ? "Opening…" : "Update payment method"}
              </button>
            ) : (
              <>
                <button
                  className="aut-btn aut-btn--primary aut-btn--glow"
                  type="button"
                  onClick={() => go("checkout")}
                  disabled={!state || busy !== null}
                >
                  {busy === "checkout" ? "Taking you to checkout…" : `Subscribe for ${price}`}
                </button>
                {state?.canManage ? (
                  <button className="aut-btn aut-btn--ghost" type="button" onClick={() => go("portal")} disabled={busy !== null}>
                    Manage subscription
                  </button>
                ) : null}
              </>
            )}
          </div>
          {!state?.signedIn && state ? (
            <p className="aut-fine">You'll create a free account first, then go straight to secure checkout with Stripe.</p>
          ) : null}
          {error ? (
            <p className="aut-fine aut-fine--error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="aut-instant__feed">
          <h3 className="aut-feed__title">
            Latest signals
            {feed && !feed.locked ? <span className="aut-live-dot" aria-label="live" /> : null}
          </h3>
          {!feed ? (
            <div className="aut-skeleton" aria-busy="true" aria-label="Loading signals" />
          ) : feed.locked ? (
            <LockedPreview price={price} onSubscribe={() => go("checkout")} busy={busy !== null} paymentFailed={Boolean(paymentFailed)} />
          ) : feed.signals.length === 0 ? (
            <p className="aut-empty">No signals yet today. You'll get a Telegram alert as soon as one is posted.</p>
          ) : (
            <ul className="aut-feed" aria-label="Latest Instant Impact signals">
              {feed.signals.map((s) => (
                <li key={s.id}>
                  <FeedCard s={s} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <RiskWarning />
    </section>
  );
}

function FeedCard({ s }: { s: FeedSignal }) {
  return (
    <article className="aut-sig">
      <header className="aut-sig__head">
        <strong className="aut-sig__pair">{s.pair}</strong>
        <span className={`aut-pill aut-pill--${s.direction === "BUY" ? "buy" : "sell"}`}>{s.direction}</span>
        <time className="aut-sig__time" dateTime={s.createdAt}>
          {timeAgo(s.createdAt)}
        </time>
      </header>
      <dl className="aut-sig__grid">
        <div>
          <dt>Entry</dt>
          <dd>{formatEntry(s.entryFrom, s.entryTo)}</dd>
        </div>
        <div>
          <dt>Stop loss</dt>
          <dd className="aut-neg">{formatPrice(s.stopLoss)}</dd>
        </div>
        {s.takeProfits.map((tp, i) => (
          <div key={i} className={i < s.targetsHit ? "is-hit" : ""}>
            <dt>
              TP{i + 1}
              {i < s.targetsHit ? <span className="aut-tick" aria-label="hit" /> : null}
            </dt>
            <dd className="aut-pos">{formatPrice(tp)}</dd>
          </div>
        ))}
      </dl>
      <p className="aut-sig__status">{STATUS_LABEL[s.status] ?? s.status}</p>
      {s.notes ? <p className="aut-sig__notes">{s.notes}</p> : null}
    </article>
  );
}

/** Placeholder cards behind a blur. Made-up numbers on purpose: the real ones are never sent to non-subscribers. */
const FAKE = [
  { pair: "XAUUSD", dir: "BUY", entry: "4,118.0 – 4,121.5", sl: "4,111.0", tps: ["4,128.0", "4,135.0", "4,150.0"] },
  { pair: "GBPJPY", dir: "SELL", entry: "198.420", sl: "198.900", tps: ["197.900", "197.400"] },
  { pair: "NAS100", dir: "BUY", entry: "21,040", sl: "20,960", tps: ["21,120", "21,200", "21,300"] },
];

function LockedPreview(props: { price: string; onSubscribe: () => void; busy: boolean; paymentFailed: boolean }) {
  return (
    <div className="aut-locked">
      <ul className="aut-feed aut-feed--blur" aria-hidden="true">
        {FAKE.map((f) => (
          <li key={f.pair}>
            <article className="aut-sig">
              <header className="aut-sig__head">
                <strong className="aut-sig__pair">{f.pair}</strong>
                <span className={`aut-pill aut-pill--${f.dir === "BUY" ? "buy" : "sell"}`}>{f.dir}</span>
                <span className="aut-sig__time">2m ago</span>
              </header>
              <dl className="aut-sig__grid">
                <div>
                  <dt>Entry</dt>
                  <dd>{f.entry}</dd>
                </div>
                <div>
                  <dt>Stop loss</dt>
                  <dd className="aut-neg">{f.sl}</dd>
                </div>
                {f.tps.map((tp, i) => (
                  <div key={i}>
                    <dt>TP{i + 1}</dt>
                    <dd className="aut-pos">{tp}</dd>
                  </div>
                ))}
              </dl>
            </article>
          </li>
        ))}
      </ul>
      <div className="aut-locked__overlay">
        <span className="aut-lock" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <rect x="5" y="10.5" width="14" height="10" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
            <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
          </svg>
        </span>
        <p className="aut-locked__text">
          {props.paymentFailed ? "Update your card to unlock the signals again." : "Subscribers see every signal live."}
        </p>
        {!props.paymentFailed ? (
          <button className="aut-btn aut-btn--primary" type="button" onClick={props.onSubscribe} disabled={props.busy}>
            Subscribe for {props.price}
          </button>
        ) : null}
      </div>
    </div>
  );
}
