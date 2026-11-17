# Navigation, SEO and launch

This folder finishes off the three new features:
- adds **Automation**, **Indicators** and **Power Rankings** to the main nav
- sets their SEO titles and descriptions, including in link previews
- lists **every env var** ([`ENV_VARS.md`](ENV_VARS.md))
- has the **test report** ([`TESTING.md`](TESTING.md))

## Main nav

`src/nav.ts` has the three entries, each with a label, short label (for a phone bottom bar), icon, link, and the paths that should highlight it:

| Item | Link | Highlighted on |
| --- | --- | --- |
| Power Rankings | `/signals/rankings` | `/signals/rankings`, `/signals/providers/*` |
| Automation | `/automation` | `/automation/*` |
| Indicators | `/indicators` | `/indicators/*` (and the old chart URL while it redirects) |

Automation and Power Rankings show a small gold **New** badge until 31 Jan 2027. Change `newUntil` in `nav.ts` to adjust it.

**If the nav maps over a list** (most do), merge the items in:
```ts
import { withNewItems } from "./site-navigation/nav";
const items = withNewItems(NAV_ITEMS, (n) => ({ label: n.label, href: n.href, icon: n.icon }));
```
This puts them right after **Signals**, in the order Power Rankings, Automation, Indicators, and removes the old chart link.

**Otherwise,** drop in the ready-made links: `<NewNavLinks pathname={location.pathname} Link={Link} />`. Pass `compact` for the short labels in a phone menu or bottom bar. They're 44px tall, so they're easy to tap.

On the signals page itself, add `<SignalsTabs current="signals" />` from `power-rankings/` so Signals and Power Rankings appear as tabs.

## SEO titles and descriptions

| Page | Title | Description |
| --- | --- | --- |
| `/automation` | Automation: Instant Impact Signals & The Sniper Bot \| VT Impact | Get VT Impact trading signals the moment they're posted for $9.99/month, or copy The Sniper Bot on VT Markets copy trading. Trading involves risk. |
| `/indicators` | Trading Indicators for TradingView, MT4 & MT5 \| VT Impact | Download VT Impact's trading indicators for MT4 and MT5, or add them to TradingView in a tap. Market structure, sessions, volatility and more. |
| `/indicators/<slug>` | `<Name>` for `<Platform>` \| VT Impact Indicators | the indicator's own description |
| `/signals/rankings` | Signal Provider Power Rankings \| VT Impact | Every VT Impact signal provider ranked by real, closed trades: net pips, win rate, profit factor and drawdown, by week, month or year. |
| `/signals/providers/<slug>` | `<Name>`: Signal Track Record & Stats \| VT Impact | `<Name>`'s full signal track record on VT Impact: net pips, win rate, drawdown, monthly results and every trade… |
| `/automation/subscribe`, `/automation/success` | (set, plus `noindex`) | checkout steps kept out of search results |

Each page sets its own title and description when it loads. The tests check that `src/seo.ts` matches them, that titles are at most 65 characters, and that descriptions are 50 to 160 characters.

### Link previews (LinkedIn, TikTok, WhatsApp)

Link-preview crawlers don't run JavaScript, so on a single-page app they only see the default title in `index.html`. Since most visitors come from shared links, it's worth fixing at the host. `injectMeta(html, pathname)` writes the right title, description, canonical and Open Graph/Twitter tags into the HTML. On Vercel, for example:

```ts
// middleware.ts (project root)
import { injectMeta } from "./src/site-navigation/seo";
export const config = { matcher: ["/automation/:path*", "/indicators/:path*", "/signals/rankings", "/signals/providers/:path*"] };
export default async function middleware(req: Request) {
  const url = new URL(req.url);
  const html = await (await fetch(new URL("/index.html", url))).text();
  return new Response(injectMeta(html, url.pathname, url.origin), { headers: { "content-type": "text/html; charset=utf-8" } });
}
```
Netlify Edge Functions and Cloudflare Pages Functions work the same way. If the site is on a host with no edge functions, the pages still set their titles for Google, which does run JavaScript. Only the preview cards fall back to the default.

### Sitemap

Add the output of `sitemapEntries()` to `sitemap.xml`. For indicator and provider pages, list their slugs too. They're in the `indicators` table and the `ranking_providers` view.

## Tests
```bash
cd site-navigation && npm install && npm test     # 7 tests: nav matching/order, SEO lengths and consistency, meta injection, sitemap
```
