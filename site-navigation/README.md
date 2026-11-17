# Navigation, SEO and launch

This folder finishes off the three new features:
- puts **Automation**, **Power Rankings** and **Indicators** on the **Home** (main) page, plus the main nav
- sets their SEO titles and descriptions, including in link previews
- lists **every env var** ([`ENV_VARS.md`](ENV_VARS.md))
- has the **test report** ([`TESTING.md`](TESTING.md))

## On the Home page

The three new pages sit on **Home** as cards near the top, not in the More menu. On a phone they're full-width, one under another; on wider screens they sit three across. Each card has an icon, a one-line description and a **live line**:

| Card | Live line |
| --- | --- |
| Automation | "Instant Impact from $9.99/month", or "You're subscribed to Instant Impact" for subscribers |
| Power Rankings | "#1 this week: Aurum +583 pips". Early in the week, before anyone has 10 trades, it shows this month's #1 and opens the rankings on this month. |
| Indicators | "4 indicators ready to use" |

If an API can't be reached, the card shows a plain description instead, so it always renders.

```tsx
import { HomeShortcuts } from "@/site-navigation/HomeShortcuts";

// near the top of the existing Home page, under its greeting:
<HomeShortcuts
  Link={Link}
  api={{
    automation: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automation`,
    indicators: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/indicators`,
    rankings: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rankings`,
  }}
  getAccessToken={async () => (await supabase.auth.getSession()).data.session?.access_token ?? null}
/>
```

See `integration-preview/examples/6-home.png`. Automation and Power Rankings show a small gold **New** badge until 31 Jan 2027 (`newUntil` in `src/nav.ts`).

**Bottom bar:** it stays Home, Chart, Signals, News, Portals, More. Six is the most that stays readable on a phone. Power Rankings is also the fifth tab on Signals, and on Automation or Indicators the bar highlights **Home**, since that's where people reach them from.

**Desktop or top nav (optional):** if the site has a wider nav, `withNewItems()` from `src/nav.ts` slots the three in after Signals and removes the old chart link. `<NewNavLinks>` gives ready-made links.

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
