// Cards for the app's Home (main) page: Automation, Indicators and Power Rankings, each with a live one-liner.
// Put <HomeShortcuts /> near the top of Home. Every line falls back to plain text if its API can't be reached,
// so the cards always render.
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { isNew, NEW_NAV_ITEMS, type NavItem } from "./nav";
import "./nav.css";

type LinkLike = ComponentType<{ to: string; className?: string; children: ReactNode }>;

export interface HomeShortcutsProps {
  /** The app's router link. Defaults to <a>. */
  Link?: LinkLike;
  /** API bases, as configured for each feature (e.g. `${VITE_SUPABASE_URL}/functions/v1/rankings`). */
  api?: { automation?: string; indicators?: string; rankings?: string };
  /** Adds `Authorization: Bearer …` so Automation can say "You're subscribed". */
  getAccessToken?: () => Promise<string | null>;
}

const FALLBACK: Record<string, string> = {
  "/automation": "Instant signals and The Sniper Bot",
  "/indicators": "TradingView, MT4 and MT5 indicators",
  "/signals/rankings": "Every signal provider, ranked",
};

const COPY: Record<string, string> = {
  "/automation": "Get our signals the second they're posted, or copy our bot on VT Markets.",
  "/indicators": "The indicators we trade with. Download them or add them in a tap.",
  "/signals/rankings": "Real, closed trades only. See who's on top right now.",
};

async function getJson<T>(url: string, token: string | null): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: token ? { authorization: `Bearer ${token}` } : {}, credentials: "include" });
    return res.ok ? ((await res.json()) as T) : null;
  } catch {
    return null;
  }
}

/** Live one-liners: price or subscription status, number of indicators, this week's #1. */
function useTeasers(props: HomeShortcutsProps) {
  const [t, setT] = useState<Record<string, string>>({});
  const [hrefs, setHrefs] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    const a = { automation: "/api/automation", indicators: "/api/indicators", rankings: "/api/rankings", ...props.api };
    (async () => {
      const token = props.getAccessToken ? await props.getAccessToken().catch(() => null) : null;
      type Board = { rows: { rank: number | null; provider: { name: string }; stats: { netPips: number } }[] };
      const [auto, inds, week] = await Promise.all([
        getJson<{ hasAccess: boolean; priceLabel: string }>(`${a.automation}/state`, token),
        getJson<{ indicators: unknown[] }>(a.indicators, token),
        getJson<Board>(`${a.rankings}?period=this-week`, null),
      ]);
      // Early in the week nobody may have enough trades to be ranked yet; show this month's #1 instead.
      let top = week?.rows.find((r) => r.rank === 1);
      let when = "this week";
      if (!top && week) {
        top = (await getJson<Board>(`${a.rankings}?period=this-month`, null))?.rows.find((r) => r.rank === 1);
        when = "this month";
        // The card quotes this month, so open the rankings on this month too.
        if (top) setHrefs({ "/signals/rankings": "/signals/rankings?period=this-month" });
      }
      if (!alive) return;
      const fmt = new Intl.NumberFormat("en-GB", { maximumFractionDigits: 1 });
      setT({
        ...(auto ? { "/automation": auto.hasAccess ? "You're subscribed to Instant Impact" : `Instant Impact from ${auto.priceLabel}` } : {}),
        ...(inds ? { "/indicators": `${inds.indicators.length} indicator${inds.indicators.length === 1 ? "" : "s"} ready to use` } : {}),
        ...(top
          ? { "/signals/rankings": `#1 ${when}: ${top.provider.name} ${top.stats.netPips >= 0 ? "+" : "−"}${fmt.format(Math.abs(top.stats.netPips))} pips` }
          : {}),
      });
    })();
    return () => {
      alive = false;
    };
  }, []);
  return { teasers: t, hrefs };
}

export function HomeShortcuts(props: HomeShortcutsProps) {
  const { teasers, hrefs } = useTeasers(props);
  const Link = props.Link;
  // Order on Home: Automation, Power Rankings, Indicators (the paid product first, then the most shareable page).
  const items = ["/automation", "/signals/rankings", "/indicators"].map((h) => NEW_NAV_ITEMS.find((n) => n.href === h)!) as NavItem[];

  return (
    <section className="vhome" aria-label="Automation, Power Rankings and Indicators">
      {items.map((item) => {
        const body = (
          <>
            <span className="vhome__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d={item.icon} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
              </svg>
            </span>
            <span className="vhome__text">
              <span className="vhome__title">
                {item.label}
                {isNew(item) ? <span className="vnav-new">New</span> : null}
              </span>
              <span className="vhome__copy">{COPY[item.href]}</span>
              <span className="vhome__live">{teasers[item.href] ?? FALLBACK[item.href]}</span>
            </span>
            <svg className="vhome__chev" viewBox="0 0 24 24" aria-hidden="true">
              <path d="m9 6 6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </>
        );
        return Link ? (
          <Link key={item.href} to={hrefs[item.href] ?? item.href} className="vhome__card">
            {body}
          </Link>
        ) : (
          <a key={item.href} href={hrefs[item.href] ?? item.href} className="vhome__card">
            {body}
          </a>
        );
      })}
    </section>
  );
}

export default HomeShortcuts;
