// Section B: The Sniper Bot, copied through VT Markets copy trading. All links come from env vars via /state.
import { useId, useMemo, useState } from "react";
import type { AutomationState } from "./api";
import { detectPlatform, openCopyLink } from "./deepLink";
import { recommendedLots } from "./format";
import { PanelHead } from "./PanelHead";
import { RiskWarning } from "./RiskWarning";

export function SniperBotSection({ state }: { state: AutomationState | null }) {
  const links = state?.links;
  const balanceId = useId();
  const [balance, setBalance] = useState("1000");
  const lots = recommendedLots(Number(balance.replace(/[,\s$]/g, "")));
  const platform = useMemo(
    () => (typeof navigator === "undefined" ? "desktop" : detectPlatform(navigator.userAgent, navigator.maxTouchPoints)),
    [],
  );

  const onCopyClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!links?.sniperBotCopy) return;
    const handled = openCopyLink(
      { webUrl: links.sniperBotCopy, appUrl: links.sniperBotApp, androidPackage: links.vtMarketsAndroidPackage },
      platform,
    );
    if (handled) e.preventDefault();
  };

  return (
    <section id="sniper-bot" className="aut-card aut-card--sniper" aria-labelledby="sb-title">
      <PanelHead
        id="sb-title"
        title="The Sniper Bot"
        help={
          <p>
            Our automated strategy on VT Markets copy trading. It trades your own VT Markets account, sized to your balance. VT Markets takes
            a 25% performance fee from profits. You can stop copying at any time in the VT Markets app.
          </p>
        }
      />
      <p className="aut-card__lead">
        Our automated strategy, copied straight onto your own VT Markets account. When The Sniper Bot opens or closes a trade, your
        account does the same, sized to your balance. Your money stays in your account and you can stop copying at any time.
      </p>

      <dl className="aut-facts">
        <div className="aut-fact">
          <dt>Performance fee</dt>
          <dd>
            <span className="aut-fact__big">25%</span>
            <span className="aut-fact__note">of the profit it makes you, settled through VT Markets copy trading</span>
          </dd>
        </div>
        <div className="aut-fact">
          <dt>Recommended size</dt>
          <dd>
            <span className="aut-fact__big">0.01 lot</span>
            <span className="aut-fact__note">per $1,000 of balance</span>
          </dd>
        </div>
        <div className="aut-fact aut-fact--wide">
          <dt>Drawdown, by design</dt>
          <dd>
            <span className="aut-fact__note">
              The Sniper Bot holds positions through pullbacks rather than cutting them early, so your account will go into drawdown at
              times. That's how the strategy works, not a fault. Size it so a drawdown doesn't worry you.
            </span>
          </dd>
        </div>
      </dl>

      <div className="aut-sizer">
        <label htmlFor={balanceId} className="aut-sizer__label">
          Your balance
        </label>
        <div className="aut-sizer__row">
          <span className="aut-sizer__prefix" aria-hidden="true">
            $
          </span>
          <input
            id={balanceId}
            className="aut-sizer__input"
            inputMode="decimal"
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
            aria-describedby={`${balanceId}-out`}
          />
          <output id={`${balanceId}-out`} className="aut-sizer__out" htmlFor={balanceId}>
            {lots > 0 ? `${lots.toFixed(2)} lot` : "–"}
          </output>
        </div>
        {lots > 0 && Number(balance.replace(/[,\s$]/g, "")) < 1000 ? (
          <p className="aut-fine">We recommend at least $1,000 so the bot can trade at 0.01 lot with room for drawdown.</p>
        ) : null}
      </div>

      <ol className="aut-steps">
        <li className="aut-step">
          <span className="aut-step__num" aria-hidden="true">
            1
          </span>
          <div className="aut-step__body">
            <h3>Open a VT Markets account</h3>
            <p>Sign up with our link so your account is set up for copy trading with us.</p>
            <ExternalButton href={links?.vtMarketsSignup} label="Open a VT Markets account" />
          </div>
        </li>
        <li className="aut-step">
          <span className="aut-step__num" aria-hidden="true">
            2
          </span>
          <div className="aut-step__body">
            <h3>Fund it</h3>
            <p>Deposit in the VT Markets app. Use the sizing above: 0.01 lot for every $1,000.</p>
          </div>
        </li>
        <li className="aut-step">
          <span className="aut-step__num" aria-hidden="true">
            3
          </span>
          <div className="aut-step__body">
            <h3>Copy The Sniper Bot</h3>
            <p>Opens The Sniper Bot in VT Markets copy trading (the listing with the 25% performance fee). Tap Copy and set your size.</p>
            <RiskWarning className="aut-risk--strong">
              Copy trading can lose money as well as make it, and The Sniper Bot can go into drawdown.
            </RiskWarning>
            {links?.sniperBotCopy ? (
              <a
                className="aut-btn aut-btn--primary aut-btn--glow aut-btn--block"
                href={links.sniperBotCopy}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onCopyClick}
              >
                Copy The Sniper Bot
              </a>
            ) : (
              <span className="aut-btn aut-btn--block aut-btn--disabled" aria-disabled="true">
                Copy The Sniper Bot
              </span>
            )}
          </div>
        </li>
      </ol>

      <p className="aut-us-note">
        <strong>In the US?</strong> VT Markets copy trading isn't available to US residents.{" "}
        {links?.crucialMarkets ? (
          <a href={links.crucialMarkets} target="_blank" rel="noopener noreferrer">
            Use Crucial Markets instead →
          </a>
        ) : (
          "Use Crucial Markets instead."
        )}
      </p>
    </section>
  );
}

function ExternalButton({ href, label }: { href: string | null | undefined; label: string }) {
  if (!href) {
    return (
      <span className="aut-btn aut-btn--ghost aut-btn--disabled" aria-disabled="true">
        {label}
      </span>
    );
  }
  return (
    <a className="aut-btn aut-btn--ghost" href={href} target="_blank" rel="noopener noreferrer">
      {label} <span aria-hidden="true">↗</span>
    </a>
  );
}
