// /indicators: grid of indicator cards with platform filter and search. Replaces the old chart page.
// Everything comes from the `indicators` table, so adding a row publishes a new card.
import { useEffect, useMemo, useState } from "react";
import { api, type IndicatorSummary, type Platform, PLATFORM_LABEL, usePageMeta } from "./api";
import { SearchIcon } from "./icons";
import { IndicatorCard } from "./IndicatorCard";
import { PanelHead } from "./PanelHead";
import { RiskWarning } from "./RiskWarning";
import { INDICATORS_SEO } from "./seo";
import "./indicators.css";

type Filter = "all" | Platform;
const FILTERS: Filter[] = ["all", "tradingview", "mt4", "mt5"];

function readUrl(): { platform: Filter; q: string } {
  if (typeof location === "undefined") return { platform: "all", q: "" };
  const p = new URLSearchParams(location.search);
  const platform = p.get("platform") as Filter | null;
  return { platform: platform && FILTERS.includes(platform) ? platform : "all", q: p.get("q") ?? "" };
}

/**
 * The "VT IMPACT INDICATORS" panel: search, platform filter and the card grid. This is the piece that drops into the
 * EXISTING Indicators page, above "MY INDICATORS" (see README, "Add to the existing Indicators page").
 */
export function IndicatorsPanel() {
  const [all, setAll] = useState<IndicatorSummary[] | null>(null);
  const [error, setError] = useState(false);
  const [{ platform, q }, setState] = useState(readUrl);

  useEffect(() => {
    api<{ indicators: IndicatorSummary[] }>("GET", "")
      .then((r) => setAll(r.indicators))
      .catch(() => setError(true));
  }, []);

  // Keep the filter in the address so a filtered view can be shared (e.g. /indicators?platform=mt5).
  useEffect(() => {
    const p = new URLSearchParams(location.search);
    platform === "all" ? p.delete("platform") : p.set("platform", platform);
    q ? p.set("q", q) : p.delete("q");
    const qs = p.toString();
    history.replaceState(history.state, "", `${location.pathname}${qs ? `?${qs}` : ""}${location.hash}`);
  }, [platform, q]);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, tradingview: 0, mt4: 0, mt5: 0 };
    for (const i of all ?? []) {
      c.all++;
      c[i.platform]++;
    }
    return c;
  }, [all]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (all ?? []).filter(
      (i) =>
        (platform === "all" || i.platform === platform) &&
        (!needle || `${i.name} ${i.description} ${PLATFORM_LABEL[i.platform]}`.toLowerCase().includes(needle)),
    );
  }, [all, platform, q]);

  return (
    <section className="ind-panel" aria-labelledby="ind-panel-title">
      <PanelHead
        id="ind-panel-title"
        title="VT Impact indicators"
        help={
          <p>
            Indicators built by VT Impact. TradingView ones open on TradingView, where you add them to your favourites. MT4 and MT5 ones
            download as a file for MetaTrader on a computer. Ones marked Members need you to be signed in.
          </p>
        }
      />
      <div className="ind-panel__body">
      <div className="ind-toolbar" role="search">
        <label className="ind-search">
          <SearchIcon />
          <span className="ind-sr">Search indicators</span>
          <input
            type="search"
            placeholder="Search indicators"
            value={q}
            onChange={(e) => setState((s) => ({ ...s, q: e.target.value }))}
            enterKeyHint="search"
          />
        </label>
        <div className="ind-filters" role="radiogroup" aria-label="Platform">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={platform === f}
              className={`ind-chip ${platform === f ? "is-on" : ""}`}
              onClick={() => setState((s) => ({ ...s, platform: f }))}
            >
              {f === "all" ? "All" : PLATFORM_LABEL[f]}
              {all ? <span className="ind-chip__n">{counts[f]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <p className="ind-empty" role="alert">
          We couldn't load the indicators. Please refresh the page.
        </p>
      ) : !all ? (
        <div className="ind-grid" aria-busy="true" aria-label="Loading indicators">
          {[0, 1, 2].map((i) => (
            <div key={i} className="ind-card ind-card--skeleton" />
          ))}
        </div>
      ) : shown.length === 0 ? (
        <div className="ind-empty" role="status">
          <p>No indicators match{q ? ` "${q}"` : ""}.</p>
          <button type="button" className="ind-btn ind-btn--ghost" onClick={() => setState({ platform: "all", q: "" })}>
            Clear filters
          </button>
        </div>
      ) : (
        <>
          <p className="ind-sr" role="status">
            {shown.length} indicator{shown.length === 1 ? "" : "s"}
          </p>
          <div className="ind-grid">
            {shown.map((i) => (
              <IndicatorCard key={i.slug} ind={i} />
            ))}
          </div>
        </>
      )}

      <RiskWarning />
      </div>
    </section>
  );
}

/** The panel for embedding: no page background or padding of its own. */
export function IndicatorsSection() {
  return (
    <div className="ind ind--embedded">
      <IndicatorsPanel />
    </div>
  );
}

/** Stand-alone /indicators page, for a site without an Indicators page of its own. */
export function IndicatorsPage() {
  usePageMeta(INDICATORS_SEO.list.title, INDICATORS_SEO.list.description);
  return (
    <main className="ind" id="main">
      <header className="ind-hero">
        <span className="ind-eyebrow">Tools</span>
        <h1 className="ind-hero__title">Indicators</h1>
        <p className="ind-hero__lead">The indicators we trade with, for TradingView, MT4 and MT5. Download them, or add them to TradingView in a tap.</p>
      </header>
      <IndicatorsPanel />
    </main>
  );
}

export default IndicatorsPage;
