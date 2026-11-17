// Drop-in for the EXISTING /automation page (the strategy builder with "New strategy", "Emergency stop" and
// "Your strategies"). Put it under the page's current header and pass the existing strategy content as
// `strategies`; nothing in that content changes.
//
//   <AutomationSections strategies={<ExistingStrategiesBody />} hasStrategies={strategies.length > 0} />
//
// Pill tabs, same pattern as Signals | Traders | Record | Rule Health:
//   Instant Impact | Sniper Bot | Strategies
// - Links can open a tab directly: /automation#instant-impact, #sniper-bot, #strategies (use these in TikTok/LinkedIn bios).
// - Without a link, people who already have strategies land on "Strategies", so the emergency stop is never
//   more than zero taps away for them; everyone else lands on Instant Impact.
import { useEffect, useState, type ReactNode } from "react";
import { useAutomationState } from "./api";
import { InstantImpactSection } from "./InstantImpactSection";
import { SniperBotSection } from "./SniperBotSection";
import "./automation.css";

export type AutomationTab = "instant-impact" | "sniper-bot" | "strategies";

const LABELS: Record<AutomationTab, string> = {
  "instant-impact": "Instant Impact",
  "sniper-bot": "Sniper Bot",
  strategies: "Strategies",
};

function tabFromHash(): AutomationTab | null {
  if (typeof location === "undefined") return null;
  const h = location.hash.replace(/^#/, "");
  return h === "instant-impact" || h === "sniper-bot" || h === "strategies" ? h : null;
}

export function AutomationSections(props: {
  /** The page's existing strategy builder (callout, emergency stop, your strategies). Leave out to show only the two products. */
  strategies?: ReactNode;
  /** True when the signed-in user has any strategies: they land on "Strategies" by default. */
  hasStrategies?: boolean;
  /** "tabs" (default) or "stack" to show everything one after another with no tabs. */
  layout?: "tabs" | "stack";
}) {
  const { state, reload } = useAutomationState();
  const tabs: AutomationTab[] = props.strategies ? ["instant-impact", "sniper-bot", "strategies"] : ["instant-impact", "sniper-bot"];
  const fallback: AutomationTab = props.strategies && props.hasStrategies ? "strategies" : "instant-impact";
  const [tab, setTab] = useState<AutomationTab>(() => tabFromHash() ?? fallback);

  useEffect(() => {
    const onHash = () => {
      const t = tabFromHash();
      if (t) setTab(t);
    };
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, []);

  const choose = (t: AutomationTab) => {
    setTab(t);
    history.replaceState(history.state, "", `${location.pathname}${location.search}#${t}`);
  };

  if (props.layout === "stack") {
    return (
      <div className="aut aut--embedded">
        <div className="aut-sections">
          <InstantImpactSection state={state} reload={reload} />
          <SniperBotSection state={state} />
          {props.strategies ? <div id="strategies">{props.strategies}</div> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="aut aut--embedded">
      <div className="aut-tabs" role="tablist" aria-label="Automation">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            id={`aut-tab-${t}`}
            aria-selected={tab === t}
            aria-controls={`aut-pane-${t}`}
            className={`aut-tab ${tab === t ? "is-on" : ""}`}
            onClick={() => choose(t)}
          >
            {LABELS[t]}
          </button>
        ))}
      </div>
      {tabs.map((t) => (
        <div key={t} id={`aut-pane-${t}`} role="tabpanel" aria-labelledby={`aut-tab-${t}`} hidden={tab !== t} className="aut-pane">
          {t === "instant-impact" ? <InstantImpactSection state={state} reload={reload} /> : null}
          {t === "sniper-bot" ? <SniperBotSection state={state} /> : null}
          {t === "strategies" ? props.strategies : null}
        </div>
      ))}
    </div>
  );
}

export default AutomationSections;
