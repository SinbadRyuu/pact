// Power Rankings.
// - RankingsSection: the body of a "Power Rankings" tab on the EXISTING Signals page
//   (Signals | Traders | Record | Rule Health | Power Rankings). This is what you add to the app.
// - RankingsPage: the same content as a stand-alone /signals/rankings page with its own tab row, for direct links.
import type { RankingsResponse } from "../shared/types";
import { AppLink, providerHref, useJson, usePageMeta, useQueryParam } from "./api";
import { dateTime, fmtPrice } from "./format";
import { Leaderboard } from "./Leaderboard";
import { PanelHead } from "./PanelHead";
import { Avatar, PeriodPicker, SignalsTabs } from "./parts";
import { Podium } from "./Podium";
import { RiskWarning } from "./RiskWarning";
import { RANKINGS_SEO } from "./seo";
import "./rankings.css";

export function RankingsContent() {
  const [period, setPeriod] = useQueryParam("period", "this-week");
  const { data, error, loading } = useJson<RankingsResponse>(`?period=${encodeURIComponent(period)}`);
  const podiumIds = new Set(data?.rows.filter((r) => r.rank !== null && r.rank <= 3).map((r) => r.provider.id));
  const rest = data?.rows.filter((r) => !podiumIds.has(r.provider.id)) ?? [];

  return (
    <>
      <section className="pr-panel" aria-labelledby="pr-rankings-title">
        <PanelHead
          id="pr-rankings-title"
          title="Power Rankings"
          help={
            <p>
              Every provider ranked by net pips from their closed trades in the period you pick. Numbers are calculated from the trade
              history, never typed in. You need {data?.minTrades ?? 10}+ closed trades in the period to be ranked, so one lucky trade
              can't take #1. Running trades aren't counted until they close.
            </p>
          }
        />
        <div className="pr-panel__body">
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
              <Podium rows={data.rows} period={period} minTrades={data.minTrades} />
            )}
          </div>
        </div>
      </section>

      {data && rest.length ? (
        <section className={`pr-panel ${loading ? "is-refreshing" : ""}`} aria-labelledby="pr-board">
          <PanelHead
            id="pr-board"
            title="Leaderboard"
            help={
              <p>
                Everyone below the podium. Tap a column heading to sort by it, and tap a name for their full record. Providers marked "Needs{" "}
                {data.minTrades} trades" are shown but not ranked yet.
              </p>
            }
          />
          <Leaderboard rows={rest} period={period} timezone={data.timezone} minTrades={data.minTrades} />
        </section>
      ) : null}

      {data?.live.length ? (
        <section className="pr-panel" aria-labelledby="pr-live">
          <PanelHead
            id="pr-live"
            title="Live now"
            help={<p>Trades that are still running. They count towards the rankings once they close.</p>}
          />
          <ul className="pr-livelist pr-panel__body">
            {data.live.map((t) => (
              <li key={t.id}>
                <AppLink to={providerHref(t.provider.slug, period)} className="pr-livecard">
                  <Avatar provider={t.provider} size={32} />
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
    </>
  );
}

/** For the existing Signals page: render this when the "Power Rankings" tab is selected. */
export function RankingsSection() {
  usePageMeta(RANKINGS_SEO.rankings.title, RANKINGS_SEO.rankings.description);
  return (
    <div className="pr pr--embedded">
      <RankingsContent />
      <RiskWarning />
    </div>
  );
}

/** Stand-alone /signals/rankings. */
export function RankingsPage() {
  usePageMeta(RANKINGS_SEO.rankings.title, RANKINGS_SEO.rankings.description);
  return (
    <main className="pr" id="main">
      <SignalsTabs current="rankings" />
      <RankingsContent />
      <RiskWarning />
    </main>
  );
}

export default RankingsPage;
