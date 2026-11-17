// Full leaderboard for everyone below the podium. Every column sorts; scrolls sideways on phones with the
// provider column pinned.
import { useMemo, useState } from "react";
import type { LeaderboardRow } from "../shared/types";
import { AppLink, providerHref } from "./api";
import { num, pct, pips, profitFactor, shortDate, tone } from "./format";
import { Avatar, RankChange } from "./parts";

type Key = "rank" | "name" | "net" | "win" | "trades" | "wlb" | "avg" | "best" | "worst" | "dd" | "pf" | "streak" | "pairs" | "last";

const COLS: { key: Key; label: string; title?: string; numeric?: boolean }[] = [
  { key: "rank", label: "Rank", numeric: true },
  { key: "name", label: "Provider" },
  { key: "net", label: "Net pips", numeric: true },
  { key: "win", label: "Win rate", numeric: true },
  { key: "trades", label: "Trades", numeric: true },
  { key: "wlb", label: "W / L / BE", title: "Wins / losses / breakevens", numeric: true },
  { key: "avg", label: "Avg pips", numeric: true },
  { key: "best", label: "Best", numeric: true },
  { key: "worst", label: "Worst", numeric: true },
  { key: "dd", label: "Max DD", title: "Maximum drawdown in pips", numeric: true },
  { key: "pf", label: "PF", title: "Profit factor: gross pips won ÷ gross pips lost", numeric: true },
  { key: "streak", label: "Streak" },
  { key: "pairs", label: "Top pairs" },
  { key: "last", label: "Last active" },
];

const streakValue = (s: string | null) => (s ? (s[0] === "W" ? 1 : -1) * Number(s.slice(1)) : 0);
const pfValue = (v: number | "inf" | null) => (v === "inf" ? Infinity : v ?? -1);

function value(r: LeaderboardRow, k: Key): number | string {
  const s = r.stats;
  switch (k) {
    case "rank":
      return r.rank ?? Infinity; // unranked sort after ranked
    case "name":
      return r.provider.name.toLowerCase();
    case "net":
      return s.netPips;
    case "win":
      return s.winRate;
    case "trades":
      return s.trades;
    case "wlb":
      return s.wins;
    case "avg":
      return s.avgPips;
    case "best":
      return s.bestPips ?? -Infinity;
    case "worst":
      return s.worstPips ?? -Infinity;
    case "dd":
      return s.maxDrawdown;
    case "pf":
      return pfValue(s.profitFactor);
    case "streak":
      return streakValue(s.streak);
    case "pairs":
      return s.topPairs[0]?.pair ?? "";
    case "last":
      return s.lastActive ?? "";
  }
}

/** Columns where smaller is better sort ascending first. */
const ASC_FIRST = new Set<Key>(["rank", "name", "dd", "pairs"]);

export function Leaderboard({ rows, period, timezone, minTrades }: { rows: LeaderboardRow[]; period: string; timezone: string; minTrades: number }) {
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const sorted = useMemo(() => {
    const list = [...rows];
    list.sort((a, b) => {
      const x = value(a, sort.key),
        y = value(b, sort.key);
      const c = x < y ? -1 : x > y ? 1 : 0;
      return c * sort.dir || (a.rank ?? Infinity) - (b.rank ?? Infinity);
    });
    return list;
  }, [rows, sort]);

  if (!rows.length) return null;

  const toggle = (key: Key) =>
    setSort((s) => (s.key === key ? { key, dir: (s.dir * -1) as 1 | -1 } : { key, dir: ASC_FIRST.has(key) ? 1 : -1 }));

  return (
    <div className="pr-tablewrap" tabIndex={0} role="region" aria-label="Leaderboard, scrolls sideways">
      <table className="pr-table">
        <caption className="pr-sr">Leaderboard. Select a column heading to sort.</caption>
        <thead>
          <tr>
            {COLS.map((c) => (
              <th
                key={c.key}
                scope="col"
                className={`${c.numeric ? "is-num" : ""} ${c.key === "name" ? "is-sticky" : ""}`}
                aria-sort={sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
              >
                <button type="button" onClick={() => toggle(c.key)} title={c.title}>
                  {c.label}
                  <span className="pr-sorticon" aria-hidden="true">
                    {sort.key === c.key ? (sort.dir === 1 ? "▲" : "▼") : "↕"}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const s = r.stats;
            return (
              <tr key={r.provider.id} className={r.rank === null ? "is-unranked" : ""}>
                <td className="is-num">
                  <span className="pr-rankcell">
                    {r.rank ?? <span title={`Needs ${minTrades} closed trades to be ranked`}>–</span>}
                    <RankChange change={r.rankChange} />
                  </span>
                </td>
                <th scope="row" className="is-sticky">
                  <AppLink to={providerHref(r.provider.slug, period)} className="pr-who">
                    <Avatar provider={r.provider} size={28} />
                    <span>
                      {r.provider.name}
                      {r.liveTrades ? <span className="pr-livepill">{r.liveTrades} live</span> : null}
                      {r.rank === null ? <span className="pr-note">Needs {minTrades} trades</span> : null}
                    </span>
                  </AppLink>
                </th>
                <td className={`is-num pr-strong ${tone(s.netPips)}`}>{pips(s.netPips)}</td>
                <td className="is-num">{pct(s.winRate)}</td>
                <td className="is-num">{num(s.trades)}</td>
                <td className="is-num">
                  {s.wins} / {s.losses} / {s.breakevens}
                </td>
                <td className={`is-num ${tone(s.avgPips)}`}>{pips(s.avgPips)}</td>
                <td className={`is-num ${tone(s.bestPips)}`}>{pips(s.bestPips)}</td>
                <td className={`is-num ${tone(s.worstPips)}`}>{pips(s.worstPips)}</td>
                <td className="is-num">{pips(s.maxDrawdown, false)}</td>
                <td className="is-num">{profitFactor(s.profitFactor)}</td>
                <td>{s.streak ? <span className={`pr-streak pr-streak--${s.streak[0]}`}>{s.streak}</span> : "–"}</td>
                <td className="pr-pairs">{s.topPairs.map((p) => p.pair).join(", ") || "–"}</td>
                <td>{s.lastActive ? shortDate(s.lastActive, timezone) : "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
