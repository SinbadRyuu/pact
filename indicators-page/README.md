# Indicators page

`vtimpact.com/indicators` replaces the old chart page. The old address sends a permanent 301 redirect here.

- **A grid of indicator cards.** Each card has the name, preview image or GIF, short description, platform badge (TradingView, MT4 or MT5), version, last updated date, download count, and a **Download** or **Get on TradingView** button.
- **Filters and search.** Platform chips (All, TradingView, MT4, MT5, with counts) and a search box, both at the top of the screen. The current filter is kept in the address, e.g. `/indicators?platform=mt5`, so filtered views can be shared.
- **Members-only indicators.** These show a gold **Members** badge with a lock. Visitors see **Sign in to download**, which brings them back to the indicator after signing in. You can also require a paid subscription (see below).
- **A detail page for each indicator** at `/indicators/<slug>`: full description, how to install, a swipeable screenshot gallery and the changelog.
- **Download counts** for every download and every TradingView open, plus a log of who downloaded what and when.
- The risk warning at the bottom of both pages.

## Adding an indicator (no code)

Indicators are rows in the `public.indicators` table. To publish one, add a row in **Supabase → Table editor → indicators**:

| Column | What to put |
| --- | --- |
| `slug` | URL name, lowercase with dashes: `session-boxes` → `/indicators/session-boxes` |
| `name`, `description` | The card title and the one-line description |
| `long_description` | The detail page's About section. A blank line starts a new paragraph |
| `platform` | `tradingview`, `mt4` or `mt5` |
| `version` | e.g. `2.3` |
| `image` | Preview image or GIF URL. 16:9 looks best. Leave it blank for a styled placeholder |
| `screenshots` | List of image URLs for the detail page |
| `install_steps` | List of steps. Leave it empty to use the standard steps for the platform |
| `changelog` | `[{"version":"2.3","date":"2026-11-02","changes":["…"]}]`, newest first |
| `file_url` | MT4/MT5 download. Use `storage:<bucket>/<file>` for a private Supabase Storage file (recommended for members-only), or any https link |
| `tradingview_url` | The TradingView script link (TradingView indicators) |
| `access_level` | `free` or `members` |
| `updated_at` | Shown as "Last updated". Change it when you release a new version |
| `published` | Untick to hide without deleting |
| `sort_order` | Lower numbers show first |

The database rejects a bad slug, an unknown platform or access level, and a row with no link at all.

**Private files.** Create a **private** bucket, e.g. `indicators`, in Supabase Storage. Upload `gold-bands-1.4.ex4` and set `file_url` to `storage:indicators/gold-bands-1.4.ex4`. Every download gets its own link that expires after 5 minutes, so members-only files can't be passed around.

## How access works

- The list and detail endpoints **never include file or TradingView links**. Links come only from `POST /api/indicators/<slug>/download`, after the access check. That same call adds one to the count.
- `members` means **signed in**. Set `INDICATORS_MEMBERS_REQUIRE_SUBSCRIPTION=true` to also require an active Instant Impact subscription. This uses the same rule as the Automation page, and the locked button then reads **Subscribe to unlock** and links to `/automation#instant-impact`.
- Row-level security is on with no policies, so the browser can't read the table directly.

## Old chart page → /indicators (301)

A 301 has to come from whatever serves the site, because the app itself can only redirect after it loads. Pick the file for the host:

| Host | File |
| --- | --- |
| Vercel | merge `redirects/vercel.json` into the project's `vercel.json` |
| Netlify / Cloudflare Pages | `redirects/_redirects` into `public/`, above the SPA fallback |
| nginx | `redirects/nginx.conf` |
| Next.js | `redirects/next.config.redirects.js` |
| Edge middleware / your own server | `legacyChartRedirect(request)` from `server/legacyRedirect.ts` |

They cover `/chart`, `/charts`, `/app/chart` and `/app/charts`, including anything after them, and keep the query string (`?ref=tiktok` survives). **Check the old chart page's exact address** and add it if it isn't one of these. Also remove the old chart route from the app and point it at `LegacyChartRedirect`, which catches in-app links. If the host can't do redirects at all (some site builders can't), `LegacyChartRedirect` is the fallback. Search engines treat that like a temporary redirect, so a host-level 301 is better.

## Files

| Path | What it is |
| --- | --- |
| `src/IndicatorsPage.tsx` | `/indicators`: header, search, platform filter, grid |
| `src/IndicatorCard.tsx` | One card |
| `src/IndicatorDetailPage.tsx` | `/indicators/:slug` |
| `src/LegacyChartRedirect.tsx` | In-app fallback for the old chart URL |
| `src/api.ts`, `src/adapters.ts` | API client; the one place it connects to the app |
| `src/indicators.css` | Styles, all `ind-` classes on the site's tokens |
| `server/router.ts` | The API, `(Request) => Response`, at `/api/indicators/*` |
| `server/store.ts` | Postgres store (with atomic download counting) and an in-memory store |
| `server/files.ts` | Signed links for private Supabase Storage files |
| `server/legacyRedirect.ts` | The 301 for the old chart URLs |
| `migrations/001_indicators.sql` | Tables, checks, indexes, RLS |
| `migrations/002_seed_vt_structure.sql` | The first entry: VT Structure (from `/indicators/vt-structure`) |
| `supabase/functions/indicators/` | Ready Supabase Edge Function |
| `redirects/` | 301 configs for each host |

## Setup

1. **Database:** run `migrations/001_indicators.sql`, then fill in the TradingView link in `002_seed_vt_structure.sql` and run it.
2. **API (Supabase):**
   ```bash
   cd indicators-page && npm install && npm run build:edge
   cp -r supabase/functions/indicators <your-supabase-project>/supabase/functions/
   supabase functions deploy indicators --no-verify-jwt     # visitors browse without signing in; downloads are checked per request
   ```
   On another host, `createIndicatorsApiFromEnv(process.env, sql, getUser)` gives a `(Request) => Response` handler. Mount it at `/api/indicators`.
3. **Add to the existing Indicators page.** The app's Indicators page already has **MY INDICATORS**, **YOUR SAVED SETTINGS** and the built-in list (Momentum, …). Keep all of that and add the new panel above MY INDICATORS:
   ```tsx
   import { IndicatorsSection } from "@/indicators";
   // first thing under the page header:
   <IndicatorsSection />
   ```
   It's a **VT IMPACT INDICATORS** panel in the same style as the others (letter-spaced header, round "?"), with search, the platform filter and the cards. See `integration-preview/examples/3-indicators.png`. `IndicatorsPage` is only for a site with no Indicators page.

   **The old chart page:** your bottom bar has **Chart**, which opens the gold chart. If that's the "chart page" the brief means, the 301 would take the live chart away from the bottom bar. Check which page should go before adding the redirect. If it's an older, separate chart page, the redirect is safe.

4. **Pages:** copy `src/` to `src/indicators/` in the app, then at start-up:
   ```ts
   import { configureIndicators } from "./indicators";
   configureIndicators({
     apiBase: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/indicators`,
     getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
     signInHref: (next) => `/sign-in?next=${encodeURIComponent(next)}`,
   });
   ```
   Routes: `/indicators` → `IndicatorsPage`, and `/indicators/:slug` → `IndicatorDetailPage` (pass `slug` from the route params). The old chart route → `LegacyChartRedirect`.
5. **Redirect:** add the 301 for your host (above).

## Env vars

See `.env.example`. On Supabase, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL` are already provided to functions. The only setting of your own is the optional `INDICATORS_MEMBERS_REQUIRE_SUBSCRIPTION`.

## Tests and preview

```bash
cd indicators-page && npm install
npm test                                      # listing, filters, access, counting, redirects
TEST_DATABASE_URL=postgres://… npm test       # + migrations, constraints, atomic counts on a throwaway Postgres
npm run preview                               # http://localhost:4320/indicators (visitor/member switch at the bottom)
```
