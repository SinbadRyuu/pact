// SEO titles and meta descriptions for every new page, in one place.
//
// The pages set these themselves once they load (each feature's src/seo.ts). LinkedIn, TikTok, WhatsApp and
// iMessage link previews don't run JavaScript though, so for previews to show the right title the HTML has to
// carry it before it's sent. `injectMeta` does that: call it from edge middleware (Vercel/Netlify/Cloudflare) on
// the index.html response. See README, "Link previews".

export interface PageMeta {
  title: string;
  description: string;
  /** Canonical path (no query string). */
  path: string;
  /** Leave the page out of search results (checkout steps). */
  noindex?: boolean;
}

const SITE = "VT Impact";

export const PAGE_META: Record<string, PageMeta> = {
  "/automation": {
    path: "/automation",
    title: "Automation: Instant Impact Signals & The Sniper Bot | VT Impact",
    description:
      "Get VT Impact trading signals the moment they're posted for $9.99/month, or copy The Sniper Bot on VT Markets copy trading. Trading involves risk.",
  },
  "/automation/subscribe": {
    path: "/automation/subscribe",
    title: "Subscribe to Instant Impact | VT Impact",
    description: "Secure checkout for Instant Impact, VT Impact's automated trading signals.",
    noindex: true,
  },
  "/automation/success": {
    path: "/automation/success",
    title: "You're in: Instant Impact | VT Impact",
    description: "Your Instant Impact subscription is active. Here's how to get your signals.",
    noindex: true,
  },
  "/indicators": {
    path: "/indicators",
    title: "Trading Indicators for TradingView, MT4 & MT5 | VT Impact",
    description:
      "Download VT Impact's trading indicators for MT4 and MT5, or add them to TradingView in a tap. Market structure, sessions, volatility and more.",
  },
  "/signals/rankings": {
    path: "/signals/rankings",
    title: "Signal Provider Power Rankings | VT Impact",
    description:
      "Every VT Impact signal provider ranked by real, closed trades: net pips, win rate, profit factor and drawdown, by week, month or year.",
  },
};

/** "gold-sniper" → "Gold Sniper" (used when we only have the slug, e.g. at the edge). */
const fromSlug = (slug: string) =>
  decodeURIComponent(slug)
    .split("-")
    .filter(Boolean)
    .map((w) => (w.length <= 3 && /\d/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1)))
    .join(" ");

/** Meta for any path the new features own, or null for paths that aren't theirs. */
export function routeMeta(pathname: string): PageMeta | null {
  const path = pathname.replace(/\/+$/, "") || "/";
  if (PAGE_META[path]) return PAGE_META[path];

  let m: RegExpExecArray | null;
  if ((m = /^\/indicators\/([a-z0-9-]+)$/.exec(path))) {
    const name = fromSlug(m[1]);
    return {
      path,
      title: `${name} Indicator | VT Impact Indicators`,
      description: `${name}: what it does, how to install it, screenshots and changelog. Download or add it to TradingView from ${SITE}.`,
    };
  }
  if ((m = /^\/signals\/providers\/([a-z0-9-]+)$/.exec(path))) {
    const name = fromSlug(m[1]);
    return {
      path,
      title: `${name}: Signal Track Record & Stats | VT Impact`,
      description: `${name}'s full signal track record on ${SITE}: net pips, win rate, drawdown, monthly results and every trade, calculated from closed trades.`,
    };
  }
  return null;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Rewrites <title>, description, canonical, robots and Open Graph / Twitter tags in an HTML document for `pathname`.
 * Returns the HTML unchanged for paths these features don't own.
 */
export function injectMeta(html: string, pathname: string, origin = "https://vtimpact.com"): string {
  const meta = routeMeta(pathname);
  if (!meta) return html;
  const url = `${origin}${meta.path}`;
  const tags = [
    `<meta name="description" content="${esc(meta.description)}">`,
    `<link rel="canonical" href="${esc(url)}">`,
    meta.noindex ? `<meta name="robots" content="noindex">` : "",
    `<meta property="og:type" content="website">`,
    `<meta property="og:site_name" content="${SITE}">`,
    `<meta property="og:title" content="${esc(meta.title)}">`,
    `<meta property="og:description" content="${esc(meta.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${esc(meta.title)}">`,
    `<meta name="twitter:description" content="${esc(meta.description)}">`,
  ]
    .filter(Boolean)
    .join("\n    ");

  let out = html
    // Drop the tags we're about to write so there's exactly one of each.
    .replace(/<meta\s+(name|property)="(description|robots|og:type|og:site_name|og:title|og:description|og:url|twitter:card|twitter:title|twitter:description)"[^>]*>\s*/gi, "")
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, "");
  out = /<title>[\s\S]*?<\/title>/i.test(out)
    ? out.replace(/<title>[\s\S]*?<\/title>/i, `<title>${esc(meta.title)}</title>`)
    : out.replace(/<head([^>]*)>/i, `<head$1>\n    <title>${esc(meta.title)}</title>`);
  return out.replace(/<\/head>/i, `    ${tags}\n  </head>`);
}

/** Sitemap entries for the static pages (indicator and provider pages: see README for generating those). */
export function sitemapEntries(origin = "https://vtimpact.com", lastmod = new Date().toISOString().slice(0, 10)) {
  return Object.values(PAGE_META)
    .filter((m) => !m.noindex)
    .map((m) => `  <url><loc>${origin}${m.path}</loc><lastmod>${lastmod}</lastmod><changefreq>daily</changefreq></url>`)
    .join("\n");
}
