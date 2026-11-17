// The Automation page's HTTP API as one Fetch-style handler: (Request) => Response.
// Mount it at /api/automation/* on whatever runs the site's server code (README, "Mount the API").
//
//   GET  /api/automation/state                 public links, price label, and the caller's subscription state
//   POST /api/automation/checkout              → { url } to Stripe Checkout (401 + signInUrl when signed out)
//   POST /api/automation/portal                → { url } to the Stripe Customer Portal
//   GET  /api/automation/checkout/confirm?session_id=…   success page check; returns the Telegram link once paid
//   GET  /api/automation/signals               the paid feed, gated here on the server
//   POST /api/automation/webhook               Stripe webhooks (signature verified)
import type Stripe from "stripe";
import { hasInstantImpactAccess } from "./access";
import { type BillingDeps, confirmCheckout, createCheckout, createPortal, handleWebhook, priceLabel } from "./billing";
import type { AutomationConfig } from "./config";
import type { BillingStore } from "./store";
import type { FeedSignal, GetUser } from "./types";

export interface AutomationApiDeps {
  config: AutomationConfig;
  stripe: Stripe;
  store: BillingStore;
  getUser: GetUser;
  /** Latest signals for the paid feed. See `createPgSignalsLoader`. */
  loadSignals: (limit: number) => Promise<FeedSignal[]>;
  /** Base path the router is mounted on. */
  basePath?: string;
  now?: () => Date;
  log?: (msg: string, extra?: unknown) => void;
}

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers },
  });

export function createAutomationApi(deps: AutomationApiDeps) {
  const base = (deps.basePath ?? "/api/automation").replace(/\/+$/, "");
  const now = deps.now ?? (() => new Date());
  const billing: BillingDeps = { config: deps.config, stripe: deps.stripe, store: deps.store, log: deps.log };
  const { config } = deps;

  async function state(req: Request) {
    const user = await deps.getUser(req);
    const rec = user ? await deps.store.getByUser(user.id) : null;
    const access = hasInstantImpactAccess(rec, now(), config.graceDays);
    return json({
      signedIn: Boolean(user),
      priceLabel: await priceLabel(billing),
      subscription: rec?.status
        ? {
            status: rec.status,
            currentPeriodEnd: rec.currentPeriodEnd?.toISOString() ?? null,
            cancelAtPeriodEnd: rec.cancelAtPeriodEnd,
          }
        : null,
      hasAccess: access,
      // A portal is useful to anyone with a Stripe customer + subscription (active, past_due, cancelled…).
      canManage: Boolean(rec?.stripeSubscriptionId),
      telegramLink: access ? config.telegramSignalsLink : null,
      links: {
        vtMarketsSignup: config.vtMarketsSignupLink,
        sniperBotCopy: config.sniperBotCopyLink,
        sniperBotApp: config.sniperBotAppLink,
        vtMarketsAndroidPackage: config.vtMarketsAndroidPackage,
        crucialMarkets: config.crucialMarketsLink,
      },
    });
  }

  async function signals(req: Request) {
    const user = await deps.getUser(req);
    const rec = user ? await deps.store.getByUser(user.id) : null;
    if (!hasInstantImpactAccess(rec, now(), config.graceDays)) {
      // Nothing real leaves the server for non-subscribers: the blurred cards on the page are placeholders.
      return json({ locked: true, reason: !user ? "signed_out" : rec?.status ?? "not_subscribed", signals: [] }, 200);
    }
    const list = await deps.loadSignals(30);
    return json({ locked: false, signals: list, telegramLink: config.telegramSignalsLink });
  }

  return async function handle(req: Request): Promise<Response | null> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith(base)) return null;
    const path = url.pathname.slice(base.length) || "/";
    const method = req.method.toUpperCase();

    try {
      if (method === "POST" && path === "/webhook") {
        // Raw body is required for signature verification: read it as text, never parse first.
        const raw = await req.text();
        const r = await handleWebhook(billing, raw, req.headers.get("stripe-signature"));
        return json(r.body, r.status);
      }

      if (method === "GET" && path === "/state") return await state(req);
      if (method === "GET" && path === "/signals") return await signals(req);

      if (method === "POST" && path === "/checkout") {
        const user = await deps.getUser(req);
        if (!user) {
          return json({ error: "sign_in_required", next: "/automation/subscribe" }, 401);
        }
        const rec = await deps.store.getByUser(user.id);
        if (hasInstantImpactAccess(rec, now(), config.graceDays)) return json({ alreadySubscribed: true }, 409);
        return json({ url: await createCheckout(billing, user) });
      }

      if (method === "POST" && path === "/portal") {
        const user = await deps.getUser(req);
        if (!user) return json({ error: "sign_in_required" }, 401);
        const url2 = await createPortal(billing, user);
        return url2 ? json({ url: url2 }) : json({ error: "no_subscription" }, 404);
      }

      if (method === "GET" && path === "/checkout/confirm") {
        const user = await deps.getUser(req);
        if (!user) return json({ error: "sign_in_required" }, 401);
        const sessionId = url.searchParams.get("session_id") ?? "";
        const r = await confirmCheckout(billing, user, sessionId);
        const rec = await deps.store.getByUser(user.id);
        const access = hasInstantImpactAccess(rec, now(), config.graceDays);
        return json({ ok: r.ok, hasAccess: access, status: rec?.status ?? null, telegramLink: access ? config.telegramSignalsLink : null });
      }

      return json({ error: "not_found" }, 404);
    } catch (err) {
      deps.log?.(`automation api error ${method} ${path}`, err);
      return json({ error: "server_error" }, 500);
    }
  };
}
