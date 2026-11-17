# Every env var for the four features

All of these are **server-side** settings. On Supabase, set them under **Edge Functions → Secrets**, or run `supabase secrets set NAME=value`. Nothing here goes in the browser bundle: the pages get the links they need from the API.

## You must fill these in

| Var | Feature | Where to get it |
| --- | --- | --- |
| `STRIPE_SECRET_KEY` | Automation | Stripe Dashboard → **Developers → API keys → Secret key**. Use `sk_test_…` while testing, then `sk_live_…` (see the go-live checklist in `automation/README.md`). |
| `STRIPE_WEBHOOK_SECRET` | Automation | Stripe Dashboard → **Developers → Webhooks → Add endpoint**. URL: `https://<project>.supabase.co/functions/v1/automation/webhook`. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, `invoice.paid`. Then copy the endpoint's **Signing secret** (`whsec_…`). Test and live have separate secrets. |
| `STRIPE_PRICE_INSTANT_IMPACT` | Automation | Stripe Dashboard → **Product catalog → Add product** "Instant Impact", recurring, $9.99 per month → copy the **Price ID** (`price_…`, not the `prod_…` ID). To change the price later, create a new price and update this var. |
| `SITE_URL` | Automation, Indicators | `https://vtimpact.com` (no trailing slash). Used for the Stripe return pages and the allowed origin. |
| `VT_MARKETS_SIGNUP_LINK` | Automation | VT Markets **IB / Partner portal → Referral links** (your IB account opening link). |
| `SNIPER_BOT_COPY_LINK` | Automation | VT Markets app → **Copy Trading → The Sniper Bot** (the listing with the 25% performance fee) → **Share** → copy the link. |
| `CRUCIAL_MARKETS_LINK` | Automation | Your Crucial Markets partner or referral link (Crucial Markets partner portal). |
| `TELEGRAM_SIGNALS_LINK` | Automation | Telegram → the private signals channel → **Manage → Invite links → Create** (turn on "Request admin approval" so a link that's passed around can't be used without you). Only subscribers ever receive it. Leave it empty if you don't use Telegram. |

## Optional

| Var | Default | Feature | Where to get it / what it does |
| --- | --- | --- | --- |
| `SNIPER_BOT_APP_LINK` | – | Automation | The VT Markets **app deep link** to The Sniper Bot. Ask your VT Markets IB account manager for it. Phones try this first, then fall back to `SNIPER_BOT_COPY_LINK`. Not needed if the share link already opens the app. |
| `VT_MARKETS_ANDROID_PACKAGE` | – | Automation | The `id=` part of the VT Markets app's Google Play URL. Makes app-or-web opening fully reliable on Android. |
| `INSTANT_IMPACT_CHANNEL_ID` | – (all channels) | Automation | Only show signals from this Trade Room channel in the paid feed. Supabase → Table editor → `channels` → copy the `id`. |
| `INSTANT_IMPACT_GRACE_DAYS` | `0` | Automation | Days of access kept after a failed payment. |
| `INDICATORS_MEMBERS_REQUIRE_SUBSCRIPTION` | `false` | Indicators | `true` = "members" indicators need an active Instant Impact subscription, not just an account. |
| `RANKINGS_MIN_TRADES` | `10` | Power Rankings | Closed trades in the period needed to be ranked or reach the podium. |
| `RANKINGS_BREAKEVEN_PIPS` | `0` | Power Rankings | Results within ± this many pips count as breakeven. |
| `RANKINGS_TIMEZONE` | `Europe/London` | Power Rankings | Where weeks, months and years start (IANA name). |
| `RANKINGS_CACHE_SECONDS` | `60` | Power Rankings | How long leaderboard results are cached. |

## Provided automatically on Supabase Edge Functions

Set these yourself **only** if you run the APIs somewhere else (Vercel, Node):

| Var | Where to get it |
| --- | --- |
| `SUPABASE_URL` | Supabase → **Project Settings → API → Project URL** |
| `SUPABASE_ANON_KEY` | Supabase → **Project Settings → API → anon public** key (used to check who's signed in) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → **Project Settings → API → service_role** key. **Server only, never in the app.** Signs private indicator downloads. |
| `SUPABASE_DB_URL` | Supabase → **Project Settings → Database → Connection string** (URI) |

## In the app (already there)

The pages call the APIs at `${VITE_SUPABASE_URL}/functions/v1/<automation|indicators|rankings>`, using the `VITE_SUPABASE_URL` the app already has. No new frontend env vars are needed.

## For running tests only

| Var | What |
| --- | --- |
| `TEST_DATABASE_URL` | A **throwaway** Postgres. The database tests drop and recreate tables. Never point it at production. |
| `STRIPE_SECRET_KEY`, `STRIPE_PRICE_INSTANT_IMPACT` | Test-mode values, for `npm run stripe:e2e` in `automation/`. That script refuses live keys. |
