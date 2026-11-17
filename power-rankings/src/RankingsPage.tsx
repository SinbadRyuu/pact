// /signals/rankings: Power Rankings. Podium, then the leaderboard for everyone else, then live trades.
import type { RankingsResponse } from "../shared/types";
import { AppLink, providerHref, useJson, usePageMeta, useQueryParam } from "./api";
import { dateTime, fmtPrice } from "./format";
import { Leaderboard } from "./Leaderboard";
import { Avatar, PeriodPicker, SignalsTabs } from "./parts";
import { Podium } from "./Podium";
import { RiskWarning } from "./RiskWarning";
import { RANKINGS_SEO } from "./seo";
import "./rankings.css";

export function RankingsPage() {
  usePageMeta(RANKINGS_SEO.rankings.title, RANKINGS_SEO.rankings.description);
  const [period, setPeriod] = useQueryParam("period", "this-week");
  const { data, error, loading } = useJson<RankingsResponse>(`?period=${encodeURIComponent(period)}`);
  const podiumIds = new Set(data?.rows.filter((r) => r.rank !== null && r.rank <= 3).map((r) => r.provider.id));
  const rest = data?.rows.filter((r) => !podiumIds.has(r.provider.id)) ?? [];

  return (
    <main className="pr" id="main">
      <SignalsTabs current="rankings" />
      <header className="pr-hero">
        <span className="pr-eyebrow">Signal providers</span>
        <h1 className="pr-hero__title">Power Rankings</h1>
        <p className="pr-hero__lead">
          Every provider ranked by net pips from their real, closed trades. Numbers are calculated from the trade history, never typed in.
          {data ? ` You need ${data.minTrades}+ closed trades in the period to be ranked.` : null}
        </p>
      </header>

      <PeriodPicker
        value={period}
        label={data?.period.label ?? " "}
        onChange={setPeriod}
        firstTradeYear={data?.firstTradeYear ?? null}
        timezone={data?.timezone ?? "Europe/London"}
      />

      <div className={`pr-body ${loading && data ? "is-refreshing" : ""}`} aria-busy={loading}>
        {error ? (
          <p className="pr-empty" role="alert">
            We couldn't load the rankings. Please refresh the page.
          </p>
        ) : !data ? (
          <div className="pr-skeleton" />
        ) : data.rows.length === 0 ? (
          <p className="pr-empty" role="status">
            No closed trades in this period yet.
          </p>
        ) : (
          <>
            <Podium rows={data.rows} period={period} minTrades={data.minTrades} />
            {rest.length ? (
              <section aria-labelledby="pr-board">
                <h2 id="pr-board" className="pr-h2">
                  Leaderboard
                </h2>
                <Leaderboard rows={rest} period={period} timezone={data.timezone} minTrades={data.minTrades} />
              </section>
            ) : null}
          </>
        )}

        {data?.live.length ? (
          <section aria-labelledby="pr-live" className="pr-live">
            <h2 id="pr-live" className="pr-h2">
              <span className="pr-livedot" aria-hidden="true" /> Live now
              <span className="pr-h2__note">Running trades. Not counted until they close.</span>
            </h2>
            <ul className="pr-livelist">
              {data.live.map((t) => (
                <li key={t.id}>
                  <AppLink to={providerHref(t.provider.slug, period)} className="pr-livecard">
                    <Avatar provider={t.provider} size={28} />
                    <span className="pr-livecard__main">
                      <span className="pr-livecard__title">
                        <strong>{t.pair}</strong> <span className={`pr-dir pr-dir--${t.direction}`}>{t.direction}</span>
                      </span>
                      <span className="pr-livecard__sub">
                        {t.provider.name} · entry {fmtPrice(t.entry)} · {dateTime(t.openedAt, data.timezone)}
                      </span>
                    </span>
                  </AppLink>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <RiskWarning />
    </main>
  );
}

export default RankingsPage;
