# Automation page

`vtimpact.com/automation` puts two products on one page:

- **Instant Impact: automated signals.** A $9.99/month subscription through Stripe Checkout. Subscribers manage or cancel it in the Stripe Customer Portal. The signals are locked on the server.
- **The Sniper Bot.** Copy trading through VT Markets: what the bot is, the 25% performance fee, 0.01 lot per $1,000, drawdown by design, and the 3-step flow. Step 3 opens the bot in the VT Markets app on phones, or on the web if the app isn't installed. US clients are pointed to Crucial Markets.

Every section shows the risk warning. The Sniper Bot also has a warning directly above **Copy The Sniper Bot**.

## How it behaves

| Who | What they see |
| --- | --- |
| Signed out | Blurred placeholder signals and **Subscribe for $9.99/month**. Tapping it goes to sign-up with `?next=/automation/subscribe`, then straight to Stripe Checkout. |
| Signed in, not subscribed | The same, and the button goes straight to Checkout. |
| Subscribed | The live feed, **Open the Telegram channel**, **Manage subscription** (Customer Portal) and the renewal date (or "Access ends …" if they've cancelled). |
| Payment failed (`past_due`) | Locked, with "Your last payment didn't go through" and **Update payment method** (Portal). Access returns when the retry succeeds. |
| Cancelled | Locked, and they can subscribe again. |

**Gating is on the server.** `GET /api/automation/signals` only returns signals to people with an active subscription. Everyone else gets `{ locked: true, signals: [] }`, and the blurred cards are made-up placeholders, so there's nothing to reveal in dev tools. The Telegram link is only ever sent to people with access.

**Access rule** (`server/access.ts`): the status is `active` or `trialing` and the paid period hasn't ended. Cancelling at the period end keeps access until that date. `past_due`, `unpaid`, `cancelled`, `incomplete` and `paused` have no access. `INSTANT_IMPACT_GRACE_DAYS` can give a few days to fix a failed card.

**The price follows the env var.** The button label is read from the Stripe price in `STRIPE_PRICE_INSTANT_IMPACT`, so changing the price ID updates "$9.99/month" everywhere.

## Files

| Path | What it is |
| --- | --- |
| `src/AutomationSections.tsx` | **Drop-in for the existing /automation page:** tabs Instant Impact, Sniper Bot, Strategies |
| `src/AutomationPage.tsx` | Stand-alone page, only for a site with no Automation page |
| `src/PanelHead.tsx` | Panel header in the app style (letter-spaced title, round "?") |
| `src/InstantImpactSection.tsx` | Section A: price, locked preview, feed, subscribe and manage buttons |
| `src/SniperBotSection.tsx` | Section B: facts, size calculator, 3 steps, US note |
| `src/SubscribePage.tsx` | `/automation/subscribe`: where sign-up sends people back to, then on to Checkout |
| `src/SuccessPage.tsx` | `/automation/success`: confirms payment and shows how to get the signals and the Telegram link |
| `src/deepLink.ts` | App-first, web-fallback opening of the Sniper Bot link |
| `src/RiskWarning.tsx` | The risk warning block |
| `src/adapters.ts` | The one place the pages connect to the app (session, access token, sign-in links) |
| `src/automation.css` | Styles, all `aut-` classes on the site's tokens |
| `server/router.ts` | The API: `(Request) => Response`, mounted at `/api/automation/*` |
| `server/billing.ts` | Checkout, Portal and webhook handling |
| `server/access.ts` | The access rule |
| `server/store.ts` | Postgres store, an in-memory store for tests, and the signals loader |
| `server/supabaseAuth.ts` | `getUser` for Supabase Auth |
| `migrations/001_instant_impact_billing.sql` | The subscriptions table and the webhook-events table |
| `supabase/functions/automation/` | A ready Supabase Edge Function that serves the API |
| `scripts/stripe-e2e.ts` | End-to-end run against real Stripe test mode |
| `test/` | Unit tests, plus a Postgres test |
| `preview/` | The real API with a fake Stripe, and a switcher for each type of user |

## Setup

### 1. Database
Run `migrations/001_instant_impact_billing.sql` in the Supabase SQL editor. It's safe to run twice. Row-level security is on with no policies, so only the server can read these tables.

### 2. Stripe, in test mode first
1. Turn on **Test mode** in the Stripe Dashboard.
2. **Product catalog → Add product**: "Instant Impact", recurring, $9.99, monthly. Copy the **price ID** (`price_…`) into `STRIPE_PRICE_INSTANT_IMPACT`.
3. **Settings → Billing → Customer portal**: allow cancelling (at the end of the period), updating the payment method and viewing invoices. Save.
4. **Developers → Webhooks → Add endpoint**:
   - URL: `https://<project>.supabase.co/functions/v1/automation/webhook`, or `https://vtimpact.com/api/automation/webhook` if you mount the API on the site.
   - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`, and also `invoice.paid`, which gives access back as soon as a failed card is fixed.
   - Copy the **Signing secret** into `STRIPE_WEBHOOK_SECRET`.
5. **Developers → API keys**: copy the **Secret key** into `STRIPE_SECRET_KEY`.

### 3. Deploy the API: Supabase Edge Function (recommended for the Lovable/Supabase app)
```bash
cd automation && npm install && node scripts/build-edge.mjs     # rebuilds automation-api.js from server/
cp -r supabase/functions/automation <your-supabase-project>/supabase/functions/
supabase secrets set --env-file automation/.env                  # the values from .env.example
supabase functions deploy automation --no-verify-jwt
```
`--no-verify-jwt` is needed because Stripe's webhook calls don't carry a Supabase token. Every other route checks the user itself through `supabaseGetUser`.

**Other hosts:** `createAutomationApiFromEnv(process.env, sql, getUser)` returns a standard `(Request) => Response` handler.
- Next.js: in `app/api/automation/[...path]/route.ts`, `const handler = async (req: Request) => (await api(req)) ?? new Response(null, { status: 404 }); export { handler as GET, handler as POST };`
- Express or plain Node: `toNodeHandler` in `server/node.ts`. Mount it before `express.json()`, because the webhook needs the raw body.
- `sql` is anything with `query(text, params)`, for example `{ query: async (t, p) => (await pool.query(t, p)).rows }`.

### 4. Add it to the existing /automation page
The app already has `/automation`: the strategy builder with **New strategy**, **Emergency stop** and **Your strategies**. Keep that page and its header. Put the new sections under the header with pill tabs, the same pattern as Signals | Traders | Record | Rule Health:

```tsx
import { AutomationSections } from "@/automation";

// in the existing Automation page, right after the header ("STEP 4 OF 4 … New strategy" and the divider):
<AutomationSections
  strategies={<>{/* the existing body: "Orders are simulated", Emergency stop, Your strategies */}</>}
  hasStrategies={strategies.length > 0}
/>
```

- Tabs: **Instant Impact | Sniper Bot | Strategies**. Your strategy builder goes in the Strategies tab, unchanged.
- People who already have strategies land on **Strategies**, so the emergency stop is right there. Everyone else lands on Instant Impact.
- Links open a tab directly: `/automation#instant-impact`, `#sniper-bot` and `#strategies`. Use them in TikTok and LinkedIn bios.
- Prefer no tabs? Pass `layout="stack"` to show the two products and then your strategies one after another.

See `integration-preview/examples/1-automation.png` for how it looks.

### 5. Add the pages to the app
1. Copy `src/` into the app as `src/automation/`.
2. In the main entry file, before rendering:
   ```ts
   import { configureAutomation } from "./automation";
   import { supabase } from "@/integrations/supabase/client";

   configureAutomation({
     useSession,                                                  // the app's session hook
     apiBase: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/automation`,  // or "/api/automation"
     getAccessToken: async () => (await supabase.auth.getSession()).data.session?.access_token ?? null,
     signInHref: (next) => `/sign-in?next=${encodeURIComponent(next)}`,
     signUpHref: (next) => `/sign-up?next=${encodeURIComponent(next)}`,
     usePageMeta: ({ title }) => usePageTitle(title),             // optional
   });
   ```
3. Add the two new routes at the top level: `...AUTOMATION_ROUTES` from `./automation` (that's `/automation/subscribe` and `/automation/success`). Don't add a second `/automation`: use `AutomationSections` inside the existing one (step 4). `AutomationPage` is only for a site that has no Automation page of its own.
4. Make sure sign-up and sign-in send people back to the `next` address once they're done. The schedule page relies on this too.

### 6. The Sniper Bot links
- `SNIPER_BOT_COPY_LINK`: in the VT Markets app, open **Copy Trading → The Sniper Bot** (the listing with the 25% fee) and tap **Share**. If that share link is an https "app link", phones with the app open it there directly.
- `SNIPER_BOT_APP_LINK` (optional): the app's own deep link to the same listing, which your VT Markets IB manager can give you. Phones try this first and fall back to the web link after about 1.6 seconds if the app doesn't open.
- `VT_MARKETS_ANDROID_PACKAGE` (optional): the app's Android package name. With it, Android uses an `intent://` link, which falls back to the web on its own. This is the most reliable option on Android.

## Tests
```bash
cd automation && npm install
npm test                                                     # 25 tests: Stripe flow, webhooks, gating, deep links
TEST_DATABASE_URL=postgres://… npm test                      # also runs the migration + store on a throwaway Postgres
STRIPE_SECRET_KEY=sk_test_… STRIPE_PRICE_INSTANT_IMPACT=price_… npm run stripe:e2e   # real Stripe test mode
```
`stripe:e2e` uses a Stripe **test clock** to go through Checkout, subscribe with a test card, fail a real renewal (declining card) and cancel. It sends Stripe's real events to the webhook handler and checks the lock at every step. It refuses live keys and deletes what it created.

**Manual click-through in test mode:** `stripe listen --forward-to localhost:<port>/api/automation/webhook`, then subscribe on the page with card `4242 4242 4242 4242`. Next, in the Portal, change the card to `4000 0000 0000 0341` (attaches but declines) and **Advance time** on the subscription's test clock, or cancel from the Portal. Check the feed locks.

## Going live: checklist
1. In Stripe, switch off Test mode and create the **live** product and price ($9.99/month). Live and test IDs are different.
2. Set **Customer portal** settings again in live mode. They're separate from test mode.
3. Add a **live webhook endpoint** with the same five events and copy its new signing secret.
4. Replace `STRIPE_SECRET_KEY` (`sk_live_…`), `STRIPE_PRICE_INSTANT_IMPACT` (live `price_…`) and `STRIPE_WEBHOOK_SECRET` (live `whsec_…`). Then redeploy, or set the secrets again on Supabase.
5. Check `SITE_URL` is `https://vtimpact.com`.
6. Fill in the business details, statement descriptor and support email under **Settings → Business** and **Public details**, and make sure the account is activated for live payments.
7. Do one real $9.99 purchase with your own card. Check that the success page shows the Telegram link, the feed unlocks and the Portal opens. Then cancel and refund it from the Dashboard.
8. Check **Developers → Webhooks → live endpoint** shows the deliveries succeeding (200).
9. Optional: turn on **Smart Retries** and the **failed-payment emails** (Settings → Billing → Subscriptions and emails), so people are told to update their card.

## Preview
```bash
cd automation && npm install && npm run preview     # http://localhost:4310/automation
```
The bar at the bottom switches between signed out, signed in, subscribed, cancelling, payment failed and cancelled.
