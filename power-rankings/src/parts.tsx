// Small shared pieces: avatar, rank change arrow, signals tabs, period picker.
import { useId, useMemo, useState } from "react";
import { jumpOptions, QUICK_PERIODS } from "../shared/periods";
import type { LeaderboardRow, Provider } from "../shared/types";
import { AppLink } from "./api";
import { rankingsDeps } from "./adapters";
import { initials } from "./format";

export function Avatar({ provider, size = 40 }: { provider: Provider; size?: number }) {
  const [broken, setBroken] = useState(false);
  return provider.avatarUrl && !broken ? (
    <img className="pr-avatar" src={provider.avatarUrl} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)} />
  ) : (
    <span className="pr-avatar pr-avatar--initials" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {initials(provider.name)}
    </span>
  );
}

export function RankChange({ change }: { change: LeaderboardRow["rankChange"] }) {
  if (change === null) return null;
  if (change === "new") return <span className="pr-change pr-change--new">New</span>;
  if (change === 0)
    return (
      <span className="pr-change pr-change--same" aria-label="No change">
        –
      </span>
    );
  const up = change > 0;
  return (
    <span className={`pr-change ${up ? "pr-change--up" : "pr-change--down"}`} aria-label={`${up ? "Up" : "Down"} ${Math.abs(change)}`}>
      <svg viewBox="0 0 10 10" aria-hidden="true">
        <path d={up ? "M5 1.5 9 7.5H1Z" : "M5 8.5 1 2.5h8Z"} fill="currentColor" />
      </svg>
      {Math.abs(change)}
    </span>
  );
}

/** "Signals | Power Rankings" tabs. Also exported for the main signals page to show the same tabs. */
export function SignalsTabs({ current }: { current: "signals" | "rankings" }) {
  const signalsHref = rankingsDeps().signalsHref ?? "/signals";
  return (
    <nav className="pr-tabs" aria-label="Signals">
      <AppLink to={signalsHref} className={`pr-tab ${current === "signals" ? "is-on" : ""}`}>
        Signals
      </AppLink>
      <AppLink to="/signals/rankings" className={`pr-tab ${current === "rankings" ? "is-on" : ""}`}>
        Power Rankings
      </AppLink>
    </nav>
  );
}

/** Quick periods, "Jump to" any past week/month/year, and a custom date range. */
export function PeriodPicker(props: { value: string; label: string; onChange: (key: string) => void; firstTradeYear: number | null; timezone: string }) {
  const id = useId();
  const [customOpen, setCustomOpen] = useState(props.value.startsWith("custom:"));
  const [from, setFrom] = useState(() => (props.value.startsWith("custom:") ? props.value.slice(7, 17) : ""));
  const [to, setTo] = useState(() => (props.value.startsWith("custom:") ? props.value.slice(19) : ""));
  const jump = useMemo(() => jumpOptions(new Date(), props.timezone, props.firstTradeYear), [props.timezone, props.firstTradeYear]);
  const jumpValue = /^(week|month|year):/.test(props.value) ? props.value : "";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="pr-period">
      <div className="pr-chips" role="radiogroup" aria-label="Time period">
        {QUICK_PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            role="radio"
            aria-checked={props.value === p.key}
            className={`pr-chip ${props.value === p.key ? "is-on" : ""}`}
            onClick={() => {
              setCustomOpen(false);
              props.onChange(p.key);
            }}
          >
            {p.label}
          </button>
        ))}
        <button
          type="button"
          role="radio"
          aria-checked={props.value.startsWith("custom:")}
          aria-expanded={customOpen}
          aria-controls={`${id}-custom`}
          className={`pr-chip ${props.value.startsWith("custom:") ? "is-on" : ""}`}
          onClick={() => setCustomOpen((o) => !o)}
        >
          Custom
        </button>
      </div>
      <div className="pr-period__row">
        <label className="pr-select">
          <span className="pr-sr">Jump to a week, month or year</span>
          <select value={jumpValue} onChange={(e) => e.target.value && props.onChange(e.target.value)}>
            <option value="">Jump to…</option>
            <optgroup label="Weeks">
              {jump.weeks.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Months">
              {jump.months.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </optgroup>
            <optgroup label="Years">
              {jump.years.map((o) => (
                <option key={o.key} value={o.key}>
                  {o.label}
                </option>
              ))}
            </optgroup>
          </select>
        </label>
        <p className="pr-period__label" aria-live="polite">
          {props.label}
        </p>
      </div>
      {customOpen ? (
        <form
          id={`${id}-custom`}
          className="pr-custom"
          onSubmit={(e) => {
            e.preventDefault();
            if (from && to) props.onChange(`custom:${from}..${to}`);
          }}
        >
          <label>
            From
            <input type="date" value={from} max={to || today} onChange={(e) => setFrom(e.target.value)} required />
          </label>
          <label>
            To
            <input type="date" value={to} min={from || undefined} max={today} onChange={(e) => setTo(e.target.value)} required />
          </label>
          <button type="submit" className="pr-btn pr-btn--primary" disabled={!from || !to}>
            Apply
          </button>
        </form>
      ) : null}
    </div>
  );
}
