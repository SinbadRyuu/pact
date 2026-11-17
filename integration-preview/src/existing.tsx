// Copies of what's ALREADY in the app, taken from the screenshots, so the new pieces can be seen in place.
// Nothing here ships: in the real app these are the existing components.
import type { ReactNode } from "react";

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
      <div className="app-header__tools">
        <Icon d="M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm9 16-4.2-4.2" />
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
  // Automation and Indicators are reached from the Home cards, so Home stays lit on them.
  const active = (p: string) =>
    p === "/home"
      ? /^\/(home|automation|indicators)(\/|$)/.test(current)
      : p === "/signals/rankings"
        ? current.startsWith("/signals")
        : current === p;
  return (
    <nav className="app-bottom" aria-label="Main">
      {BOTTOM.map((b) => (
        <button key={b.label} type="button" className={`app-bottom__item ${active(b.page) ? "is-on" : ""}`} onClick={() => go(b.page)}>
          <span className="app-bottom__icon">
            <Icon d={b.d} />
          </span>
          {b.label}
        </button>
      ))}
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

/** Top of the existing Home page (greeting). Your real Home has its own; this stands in for it. */
export function HomeHeader() {
  return (
    <header className="x-pagehead">
      <p className="x-hello">Good morning</p>
      <h1 className="x-title">Home</h1>
      <p className="x-lead">Everything VT Impact, in one place.</p>
    </header>
  );
}

/** Stand-in for the rest of the existing Home page, which doesn't change. */
export function HomeRest() {
  return (
    <div className="x-stack">
      <div className="x-placeholder">Your existing Home content continues here, unchanged.</div>
      <div className="x-placeholder x-placeholder--short" />
    </div>
  );
}
