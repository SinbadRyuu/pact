// /signals/providers/:slug: one provider's stats, cumulative pips, monthly breakdown, live trades and history.
import type { ProviderProfileResponse } from "../shared/types";
import { AppLink, useJson, usePageMeta, useQueryParam } from "./api";
import { EquityChart, MonthlyChart } from "./charts";
import { dateTime, fmtPrice, monthLabel, num, pct, pips, profitFactor, shortDate, tone } from "./format";
import { Avatar, PeriodPicker, RankChange, SignalsTabs } from "./parts";
import { RiskWarning } from "./RiskWarning";
import { RANKINGS_SEO } from "./seo";
import { TradeHistory } from "./TradeHistory";
import "./rankings.css";

export function ProviderPage({ slug }: { slug: string }) {
  const [period, setPeriod] = useQueryParam("period", "this-week");
  const { data, error, loading } = useJson<ProviderProfileResponse>(`/providers/${encodeURIComponent(slug)}?period=${encodeURIComponent(period)}`);
  const seo = data ? RANKINGS_SEO.provider(data.provider.name) : RANKINGS_SEO.rankings;
  usePageMeta(seo.title, seo.description);

  if (error === 404) {
    return (
      <main className="pr" id="main">
        <SignalsTabs current="rankings" />
        <p className="pr-empty" role="alert">
          We couldn't find that provider. <AppLink to="/signals/rankings">Back to Power Rankings</AppLink>
        </p>
      </main>
    );
  }

  const s = data?.stats;
  const tiles: { label: string; value: string; tone?: string; hint?: string }[] = s
    ? [
        { label: "Net pips", value: pips(s.netPips), tone: tone(s.netPips) },
        { label: "Win rate", value: pct(s.winRate) },
        { label: "Trades", value: num(s.trades), hint: `${s.wins}W · ${s.losses}L · ${s.breakevens}BE` },
        { label: "Avg pips / trade", value: pips(s.avgPips), tone: tone(s.avgPips) },
        { label: "Best trade", value: pips(s.bestPips), tone: tone(s.bestPips) },
        { label: "Worst trade", value: pips(s.worstPips), tone: tone(s.worstPips) },
        { label: "Max drawdown", value: `${pips(s.maxDrawdown, false)} pips` },
        { label: "Profit factor", value: profitFactor(s.profitFactor), hint: "pips won ÷ pips lost" },
        { label: "Current streak", value: s.streak ?? "–" },
        { label: "Most traded", value: s.topPairs.map((p) => p.pair).join(", ") || "–" },
        { label: "Last active", value: s.lastActive && data ? shortDate(s.lastActive, data.timezone) : "–" },
      ]
    : [];

  return (
    <main className="pr" id="main">
      <SignalsTabs current="rankings" />
      <AppLink to={`/signals/rankings${period !== "this-week" ? `?period=${encodeURIComponent(period)}` : ""}`} className="pr-back">
        ← Power Rankings
      </AppLink>

      {data ? (
        <header className="pr-profile">
          <Avatar provider={data.provider} size={72} />
          <div>
            <h1 className="pr-profile__name">{data.provider.name}</h1>
            <p className="pr-profile__rank">
              {data.rank !== null ? (
                <>
                  <span className={`pr-rankbadge ${data.rank <= 3 ? `pr-rankbadge--${["gold", "silver", "bronze"][data.rank - 1]}` : ""}`}>#{data.rank}</span> of{" "}
                  {data.rankedOf} <RankChange change={data.rankChange} />
                </>
              ) : (
                <span className="pr-note">Not ranked this period: needs {data.minTrades} closed trades</span>
              )}
            </p>
          </div>
        </header>
      ) : (
        <div className="pr-skeleton pr-skeleton--short" />
      )}

      <PeriodPicker
        value={period}
        label={data?.period.label ?? " "}
        onChange={setPeriod}
        firstTradeYear={data?.firstTradeYear ?? null}
        timezone={data?.timezone ?? "Europe/London"}
      />

      {data && s ? (
        <div className={`pr-body ${loading ? "is-refreshing" : ""}`}>
          <dl className="pr-tiles">
            {tiles.map((t) => (
              <div key={t.label} className="pr-tile">
                <dt>{t.label}</dt>
                <dd className={t.tone}>{t.value}</dd>
                {t.hint ? <dd className="pr-tile__hint">{t.hint}</dd> : null}
              </div>
            ))}
          </dl>

          <section className="pr-section" aria-labelledby="pr-equity">
            <h2 id="pr-equity" className="pr-h2">
              Cumulative pips
            </h2>
            <EquityChart points={data.equity} tz={data.timezone} total={s.trades} />
          </section>

          <section className="pr-section" aria-labelledby="pr-monthly">
            <h2 id="pr-monthly" className="pr-h2">
              Month by month
            </h2>
            <MonthlyChart months={data.monthly} />
            {data.monthly.length ? (
              <details className="pr-details">
                <summary>Show as a table</summary>
                <table className="pr-table pr-table--mini">
                  <thead>
                    <tr>
                      <th scope="col">Month</th>
                      <th scope="col" className="is-num">
                        Pips
                      </th>
                      <th scope="col" className="is-num">
                        Trades
                      </th>
                      <th scope="col" className="is-num">
                        Win rate
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((m) => (
                      <tr key={m.month}>
                        <th scope="row">{monthLabel(m.month, true)}</th>
                        <td className={`is-num ${tone(m.pips)}`}>{pips(m.pips)}</td>
                        <td className="is-num">{m.trades}</td>
                        <td className="is-num">{pct(m.winRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </details>
            ) : null}
          </section>

          {data.live.length ? (
            <section className="pr-section" aria-labelledby="pr-plive">
              <h2 id="pr-plive" className="pr-h2">
                <span className="pr-livedot" aria-hidden="true" /> Live now
                <span className="pr-h2__note">Not counted in the stats until they close.</span>
              </h2>
              <ul className="pr-livelist">
                {data.live.map((t) => (
                  <li key={t.id} className="pr-livecard">
                    <span className="pr-livecard__main">
                      <span className="pr-livecard__title">
                        <strong>{t.pair}</strong> <span className={`pr-dir pr-dir--${t.direction}`}>{t.direction}</span>
                      </span>
                      <span className="pr-livecard__sub">
                        Entry {fmtPrice(t.entry)} · SL {fmtPrice(t.stopLoss)} · opened {dateTime(t.openedAt, data.timezone)}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <TradeHistory slug={slug} pairs={data.pairs} timezone={data.timezone} />
        </div>
      ) : error ? (
        <p className="pr-empty" role="alert">
          We couldn't load this provider. Please refresh.
        </p>
      ) : (
        <div className="pr-skeleton" />
      )}

      <RiskWarning />
    </main>
  );
}

export default ProviderPage;
