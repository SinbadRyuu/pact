// Trade Room: one signal in the Gold Signals list.
// Pair and direction, entry and stop loss, up to six take profits (three per row), notes, chart, and the progress line.
import { Icon } from "./icons";
import { DEFAULT_PAIRS, formatEntry, formatPrice, progressLabel, timeAgo, type Pair, type Signal } from "./signal";
import "./signals.css";

export interface SignalCardProps {
  signal: Signal;
  pairs?: Pair[];
  /** Small label set into the top border, e.g. "Example template". */
  badge?: string;
  /** Opens the signal's detail view from the progress line. */
  onOpen?: (id: string) => void;
  now?: number;
}

export function SignalCard({ signal: s, pairs = DEFAULT_PAIRS, badge, onOpen, now }: SignalCardProps) {
  const pairName = pairs.find((p) => p.symbol === s.pair)?.name ?? "";
  const buy = s.direction === "BUY";
  const ended = s.status !== "active";
  const tone = s.status === "stop_loss" ? "negative" : s.status === "take_profit" || s.targetsHit > 0 ? "positive" : "neutral";
  const Progress = onOpen ? "button" : "div";

  return (
    <article className="sg sg-card" data-badge={badge ? "" : undefined} aria-label={`${s.pair} ${s.direction} signal`}>
      {badge && <span className="sg-card__badge">{badge}</span>}

      <header className="sg-card__head">
        <span className="sg-card__coin" aria-hidden="true">
          <Icon name="gold" size={24} />
        </span>
        <div className="sg-card__pair">
          <h3>{s.pair}</h3>
          {pairName && <p>{pairName}</p>}
        </div>
        <div className="sg-card__meta">
          <span className={`sg-dir sg-dir--${buy ? "buy" : "sell"}`}>
            <Icon name={buy ? "up" : "down"} size={12} />
            {s.direction}
          </span>
          <time dateTime={s.createdAt} className="sg-card__time">
            <Icon name="clock" size={12} />
            {timeAgo(s.createdAt, now)}
          </time>
        </div>
      </header>

      <dl className="sg-card__levels">
        <div>
          <dt>{s.entryTo === null ? "Entry" : "Entry range"}</dt>
          <dd>{formatEntry(s)}</dd>
        </div>
        <div>
          <dt>Stop loss</dt>
          <dd>{formatPrice(s.stopLoss)}</dd>
        </div>
      </dl>

      <ol className="sg-card__tps">
        {s.takeProfits.map((tp, i) => {
          const hit = i < s.targetsHit;
          return (
            <li key={i} className={hit ? "is-hit" : undefined}>
              <Icon name={hit ? "check" : "target"} size={20} className="sg-card__tp-icon" />
              <span>
                <span className="sg-card__tp-label">
                  TP{i + 1}
                  {hit && <span className="sg-visually-hidden"> (hit)</span>}
                </span>
                <span className="sg-card__tp-value">{formatPrice(tp)}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {(s.notes || s.chartUrl) && (
        <div className="sg-card__extra">
          {s.notes && (
            <p className="sg-card__notes">
              <Icon name="note" size={14} />
              {s.notes}
            </p>
          )}
          {s.chartUrl && (
            <a href={s.chartUrl} target="_blank" rel="noreferrer" className="sg-card__chart">
              <img src={s.chartUrl} alt={`Chart analysis for ${s.pair}`} loading="lazy" />
            </a>
          )}
        </div>
      )}

      <Progress
        className={`sg-card__progress sg-card__progress--${tone}`}
        {...(onOpen ? { type: "button" as const, onClick: () => onOpen(s.id) } : {})}
      >
        <Icon name={ended && s.status === "stop_loss" ? "x" : "check"} size={16} className="sg-card__progress-icon" />
        <span>{progressLabel(s)}</span>
        <span className="sg-card__dots" aria-hidden="true">
          {s.takeProfits.map((_, i) => (
            <span key={i} className={i < s.targetsHit ? "is-on" : undefined} />
          ))}
        </span>
        {onOpen && <Icon name="arrow" size={14} className="sg-card__progress-arrow" />}
      </Progress>
    </article>
  );
}
