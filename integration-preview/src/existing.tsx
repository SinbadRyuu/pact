// Copies of what's ALREADY in the app, taken from the screenshots, so the new pieces can be seen in place.
// Nothing here ships: in the real app these are the existing components.
import type { ComponentType, ReactNode } from "react";
import { GO_TO_ADDITIONS, withGoToCards } from "../../site-navigation/src/goTo";

export function AppHeader() {
  return (
    <header className="app-header">
      <svg className="app-logo" viewBox="0 0 120 64" aria-label="VT Impact">
        <defs>
          <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0" stopColor="#3ee8ff" />
            <stop offset="0.55" stopColor="#8b6cff" />
            <stop offset="1" stopColor="#ff4fd8" />
          </linearGradient>
        </defs>
        <path d="M4 6h22l22 40L70 6h46l-4 8H86L64 58H40Z" fill="url(#lg)" />
      </svg>
      <span className="app-ticker">
        <span className="app-ticker__dot" /> XAUUSD <strong>$3,862.94</strong> <span className="app-ticker__chg">↓ −0.40%</span> MT5
      </span>
      <div className="app-header__tools">
        <span className="app-search">
          <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2" size={18} /> Search <kbd>/</kbd>
        </span>
        <span className="app-search-icon">
          <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2" />
        </span>
        <span className="app-bell">
          <Icon d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4Zm4 4h4" />
          <span className="app-badge">4</span>
        </span>
        <span className="app-avatar" aria-hidden="true" />
        <Icon d="m6 9 6 6 6-6" />
      </div>
    </header>
  );
}

export function Icon({ d, size = 26 }: { d: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const BOTTOM = [
  { label: "Home", d: "M4 11 12 4l8 7v9h-5v-6H9v6H4Z", page: "/home" },
  { label: "Chart", d: "M4 4v16h16M7 15l4-5 3 3 5-6", page: "/chart" },
  { label: "Signals", d: "M3 12h4l3-7 4 14 3-7h4", page: "/signals/rankings" },
  { label: "News", d: "M5 4h11v16H6a1 1 0 0 1-1-1Zm11 4h3v11a1 1 0 0 1-1 1M8 8h5M8 12h5M8 16h3", page: "/news" },
  { label: "Portals", d: "M4 4h7v7H4Zm9 0h7v7h-7ZM4 13h7v7H4Zm9 0h7v7h-7Z", page: "/portals" },
  { label: "More", d: "M5 12h.01M12 12h.01M19 12h.01", page: "/more" },
];

export function BottomNav({ current, go }: { current: string; go: (page: string) => void }) {
  // Automation and Indicators are opened from the Home GO TO cards, so Home stays lit on them.
  const active = (p: string) =>
    p === "/home" ? /^\/(home|automation|indicators)(\/|$)/.test(current) : p === "/signals/rankings" ? current.startsWith("/signals") : current === p;
  return (
    <nav className="app-bottom" aria-label="Main">
      <span className="app-side-logo" aria-hidden="true">
        <svg viewBox="0 0 120 64" width="44" height="24">
          <path d="M4 6h22l22 40L70 6h46l-4 8H86L64 58H40Z" fill="url(#lg)" />
        </svg>
      </span>
      {BOTTOM.map((b) => (
        <button key={b.label} type="button" className={`app-bottom__item ${active(b.page) ? "is-on" : ""}`} onClick={() => go(b.page)}>
          <span className="app-bottom__icon">
            <Icon d={b.d} />
          </span>
          {b.label}
        </button>
      ))}
      <span className="app-side-foot">
        <Icon d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6Z" size={18} />
        Simulated orders only
      </span>
    </nav>
  );
}

export function Panel({ title, action, children, footer }: { title: string; action?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <section className="x-panel">
      <div className="x-panel__head">
        <h2>{title}</h2>
        <div className="x-panel__tools">
          {action}
          <span className="x-help">?</span>
        </div>
      </div>
      <div className="x-panel__body">{children}</div>
      {footer ? <div className="x-panel__foot">{footer}</div> : null}
    </section>
  );
}

export function Empty({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="x-empty">
      <h3>{title}</h3>
      <p>{children}</p>
    </div>
  );
}

/** Existing /automation header: "STEP 4 OF 4 IN THE FLOW · AUTOMATION". */
export function AutomationHeader() {
  return (
    <header className="x-pagehead">
      <p className="x-step">
        <span>4</span> Step 4 of 4 in the flow
      </p>
      <div className="x-titlerow">
        <h1 className="x-title">Automation</h1>
        <span className="x-what">
          <span className="x-what__q">?</span> What am I looking at?
        </span>
      </div>
      <p className="x-lead">Rules for gold that act on each completed candle, inside your limits. New strategies start stopped.</p>
      <span className="x-gradbtn">＋ New strategy</span>
      <hr className="x-rule" />
    </header>
  );
}

/** Existing strategy builder body: simulated-orders callout, emergency stop, your strategies. */
export function StrategiesBody() {
  return (
    <div className="x-stack">
      <div className="x-callout">
        <span className="x-callout__i">i</span>
        <p>
          <strong>Orders are simulated</strong>
          <br />
          Automation places simulated orders only. No broker is connected, so it never places a real trade.
        </p>
      </div>
      <h2 className="x-h2">Emergency stop</h2>
      <p className="x-lead">
        Stops every strategy on your account at once and closes open simulated positions at the latest price. It works even when you are rate
        limited, and needs no password.
      </p>
      <span className="x-dangerbtn">◻ Stop all strategies</span>
      <Panel title="Your strategies">
        <Empty title="No strategies yet">A strategy pairs an entry rule and an exit rule. Tap New strategy to start one.</Empty>
      </Panel>
    </div>
  );
}

export function IndicatorsHeader() {
  return (
    <header className="x-pagehead">
      <h1 className="x-title">Indicators</h1>
      <p className="x-lead">
        Studies you can add to any price chart, plus the indicators we build. Indicators describe the past; they do not predict prices.
      </p>
      <hr className="x-rule" />
    </header>
  );
}

/** Existing Indicators sections: My indicators, Your saved settings, the Momentum list. */
export function ExistingIndicators() {
  const cat = [
    ["MACD", "The gap between a fast and a slow exponential average, with a signal line."],
    ["Price pressure", "Which way recent candles have been pushing, from -100 to +100, read from the candles alone."],
    ["Relative strength index", "Compares the size of recent gains with recent losses on a 0 to 100 scale."],
  ];
  return (
    <div className="x-stack">
      <Panel title="My indicators" action={<span className="x-outlinebtn">＋ Add a script</span>} footer="VT Impact keeps your Pine code as text and never runs it. Only you can see it.">
        <Empty title="No scripts yet">
          Keep the Pine code of the TradingView indicators you use here, so you can copy it onto any TradingView chart. Your indicator's alerts can also
          be sent to VT Impact and drawn on the gold chart.
        </Empty>
      </Panel>
      <Panel title="Your saved settings" action={<span className="x-outlinebtn">＋ New settings</span>}>
        <Empty title="No saved settings yet">
          Choose an indicator below and save the periods and levels you prefer. Saved settings appear in the indicator menu on every price chart.
        </Empty>
      </Panel>
      <h2 className="x-h2">Momentum</h2>
      <div className="x-list">
        {cat.map(([name, desc]) => (
          <div key={name} className="x-item">
            <div className="x-item__top">
              <h3>{name}</h3>
              <span className="x-star">☆</span>
            </div>
            <p>{desc}</p>
            <div className="x-item__links">
              <span className="x-link">How it works</span>
              <span className="x-link x-link--plain">⚙ Save settings</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function SignalsHeader() {
  return (
    <header className="x-pagehead">
      <h1 className="x-title">Signals</h1>
      <p className="x-lead">Gold signals from our traders and rules, with every result on the record.</p>
    </header>
  );
}

/** The existing tab row with "Power Rankings" added at the end. */
export const SIGNALS_TABS = [
  { label: "Signals", href: "/signals" },
  { label: "Traders", href: "/signals/traders" },
  { label: "Record", href: "/signals/record" },
  { label: "Rule Health", href: "/signals/rule-health" },
];

/** Stand-in for the top of the existing Home page (the checklist above GO TO). */
export function HomeTop() {
  return (
    <div className="x-hometop">
      <span className="x-hometop__check" />
      <div>
        <strong>Set a price alert</strong>
        <p>Get told when a price is reached.</p>
      </div>
      <span className="x-xp">+25 XP</span>
    </div>
  );
}

type Card = { title: string; description: string; href: string; icon: string[]; isNew?: boolean };
const EXISTING_GO_TO: Card[] = [
  { title: "Signals", description: "Gold signals and why they fired", href: "/signals", icon: ["M22 12h-4l-3 9L9 3l-3 9H2"] },
  { title: "Trader Signals", description: "Signals posted in the traders' groups", href: "/signals/traders", icon: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"] },
  { title: "Chart", description: "Gold's chart with your indicators", href: "/chart", icon: ["M3 3v18h18", "m19 9-5 5-4-4-3 3"] },
  { title: "Indicators", description: "Built-in indicators, your settings and scripts", href: "/indicators", icon: ["M21 4h-7M10 4H3M21 12h-9M8 12H3M21 20h-5M12 20H3M14 2v4M8 10v4M16 18v4"] },
  { title: "News", description: "Economic calendar: what is due and the figures", href: "/news", icon: ["M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2Zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2", "M18 14h-8", "M15 18h-5", "M10 6h8v4h-8V6Z"] },
  { title: "Dashboard", description: "Gold at a glance: price, sessions and the flow", href: "/dashboard", icon: ["M3 3h7v7H3ZM14 3h7v7h-7ZM14 14h7v7h-7ZM3 14h7v7H3Z"] },
  { title: "Trade Journal", description: "Your own trades and what they show", href: "/journal", icon: ["M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z", "M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"] },
  { title: "Phone Alerts", description: "Signals and levels sent to your phone", href: "/alerts", icon: ["M4 3h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z", "M8 21h8", "M12 17v4"] },
  { title: "Everything Else", description: "Automation, practice, settings and more", href: "/more", icon: ["M12 12h.01M19 12h.01M5 12h.01"] },
];

/** The existing GO TO grid with the two new cards added by withGoToCards (exactly what the app does). */
export function HomeGoTo({ Link }: { Link: ComponentType<{ to: string; className?: string; children: ReactNode }> }) {
  const cards = withGoToCards<Card>(
    EXISTING_GO_TO,
    (c) => ({ title: c.title, description: c.description, href: c.href, icon: c.iconPaths, isNew: true }),
    { updateCopy: (c, d) => ({ ...c, description: d }) },
  );
  return (
    <section className="x-goto" aria-labelledby="goto">
      <h2 id="goto" className="x-goto__label">
        Go to
      </h2>
      <div className="x-goto__grid">
        {cards.map((c) => (
          <Link key={c.title} to={c.href} className={`x-goto__card ${c.isNew ? "is-new" : ""}`}>
            <span className="x-goto__icon">
              <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                {c.icon.map((d) => (
                  <path key={d} d={d} fill="none" stroke="currentColor" strokeWidth={c.title === "Everything Else" ? 3 : 1.7} strokeLinecap="round" strokeLinejoin="round" />
                ))}
              </svg>
            </span>
            <svg className="x-goto__arrow" viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
              <path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            <strong className="x-goto__title">{c.title}</strong>
            <span className="x-goto__desc">{c.description}</span>
          </Link>
        ))}
      </div>
      <div className="x-goto__card x-goto__card--wide">
        <span className="x-goto__icon">
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M12 3c4.4 0 8 1.3 8 3s-3.6 3-8 3-8-1.3-8-3 3.6-3 8-3ZM4 6v12c0 1.7 3.6 3 8 3s8-1.3 8-3V6M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" fill="none" stroke="currentColor" strokeWidth="1.7" />
          </svg>
        </span>
        <span>
          <strong className="x-goto__title">Impact Investment</strong>
          <span className="x-goto__desc">Money basics, markets and live calls</span>
        </span>
      </div>
    </section>
  );
}

export { GO_TO_ADDITIONS };
