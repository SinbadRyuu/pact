// Top 3: #2 silver on the left, #1 gold in the middle (raised, glow, crown), #3 bronze on the right.
// On phones the cards stack with #1 first (CSS order), so the winner is what people see first.
import type { LeaderboardRow } from "../shared/types";
import { AppLink, providerHref } from "./api";
import { Sparkline } from "./charts";
import { num, pct, pips } from "./format";
import { Avatar, RankChange } from "./parts";

const PLACE = { 1: "gold", 2: "silver", 3: "bronze" } as const;

export function Podium({ rows, period, minTrades }: { rows: LeaderboardRow[]; period: string; minTrades: number }) {
  const top = rows.filter((r) => r.rank !== null && r.rank <= 3);
  if (!top.length) {
    return (
      <div className="pr-podium pr-podium--empty" role="status">
        <p>No one has {minTrades}+ closed trades in this period yet, so there's no podium. Try a longer period.</p>
      </div>
    );
  }
  return (
    <ol className="pr-podium" aria-label="Top 3 providers">
      {top.map((r) => {
        const place = PLACE[r.rank as 1 | 2 | 3];
        return (
          <li key={r.provider.id} className={`pr-pod pr-pod--${place}`}>
            <AppLink to={providerHref(r.provider.slug, period)} className="pr-pod__link" aria-label={`#${r.rank} ${r.provider.name}, view profile`}>
              {r.rank === 1 ? (
                <svg className="pr-crown" viewBox="0 0 32 22" aria-hidden="true">
                  <path d="M2 19 4 5l7 7 5-10 5 10 7-7 2 14Z" fill="currentColor" />
                  <rect x="2" y="19" width="28" height="3" rx="1.5" fill="currentColor" />
                </svg>
              ) : null}
              <div className="pr-pod__top">
                <span className="pr-pod__place">#{r.rank}</span>
                <RankChange change={r.rankChange} />
              </div>
              <div className="pr-pod__who">
                <Avatar provider={r.provider} size={r.rank === 1 ? 64 : 52} />
                <h3 className="pr-pod__name">{r.provider.name}</h3>
              </div>
              <p className={`pr-pod__pips ${r.stats.netPips >= 0 ? "pr-pos" : "pr-neg"}`}>
                {pips(r.stats.netPips)}
                <span> pips</span>
              </p>
              <Sparkline points={r.equity} />
              <dl className="pr-pod__stats">
                <div>
                  <dt>Win rate</dt>
                  <dd>{pct(r.stats.winRate)}</dd>
                </div>
                <div>
                  <dt>Trades</dt>
                  <dd>{num(r.stats.trades)}</dd>
                </div>
              </dl>
            </AppLink>
          </li>
        );
      })}
    </ol>
  );
}
