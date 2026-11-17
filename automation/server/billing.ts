// Stripe Checkout, Customer Portal and webhook handling for Instant Impact.
//
// Design notes
// - Stripe is the source of truth. Every webhook re-reads the subscription from Stripe and stores its *current*
//   state, so events arriving late or out of order can't leave a stale status behind.
// - The user id travels to Stripe three ways (client_reference_id, session metadata, subscription metadata) and the
//   customer id is stored before Checkout, so any event can be matched back to the account.
import Stripe from "stripe";
import { mapStripeStatus } from "./access";
import type { AutomationConfig } from "./config";
import type { BillingStore } from "./store";
import type { AuthUser, SubscriptionRecord } from "./types";

/** Real Stripe client, using fetch + Web Crypto so it also runs on edge runtimes (Supabase, Cloudflare). */
export function createStripeClient(secretKey: string): Stripe {
  return new Stripe(secretKey, {
    httpClient: Stripe.createFetchHttpClient(),
    appInfo: { name: "vtimpact-automation", version: "1.0.0" },
  });
}

const cryptoProvider = Stripe.createSubtleCryptoProvider();

export interface BillingDeps {
  config: AutomationConfig;
  stripe: Stripe;
  store: BillingStore;
  log?: (msg: string, extra?: unknown) => void;
}

/** Finds or creates the Stripe customer for this user and remembers it. */
async function ensureCustomer(deps: BillingDeps, user: AuthUser): Promise<string> {
  const existing = await deps.store.getByUser(user.id);
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const customer = await deps.stripe.customers.create(
    { email: user.email ?? undefined, metadata: { user_id: user.id } },
    // Same key for 24h: a double-tap on Subscribe can't create two customers.
    { idempotencyKey: `vti-customer-${user.id}` },
  );
  await deps.store.setCustomer(user.id, customer.id);
  return customer.id;
}

/** Creates a Checkout Session (subscription mode) and returns its URL. */
export async function createCheckout(deps: BillingDeps, user: AuthUser): Promise<string> {
  const { config, stripe } = deps;
  const customer = await ensureCustomer(deps, user);
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer,
    line_items: [{ price: config.priceInstantImpact, quantity: 1 }],
    client_reference_id: user.id,
    metadata: { user_id: user.id, product: "instant_impact" },
    subscription_data: { metadata: { user_id: user.id, product: "instant_impact" } },
    allow_promotion_codes: true,
    success_url: `${config.siteUrl}/automation/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.siteUrl}/automation?checkout=cancelled#instant-impact`,
  });
  if (!session.url) throw new Error("Stripe did not return a Checkout URL");
  return session.url;
}

/** Opens the Stripe Customer Portal (cancel, update card, invoices). */
export async function createPortal(deps: BillingDeps, user: AuthUser): Promise<string | null> {
  const rec = await deps.store.getByUser(user.id);
  if (!rec?.stripeCustomerId) return null;
  const portal = await deps.stripe.billingPortal.sessions.create({
    customer: rec.stripeCustomerId,
    return_url: `${deps.config.siteUrl}/automation#instant-impact`,
  });
  return portal.url;
}

/** Period end moved from the subscription to its items in newer Stripe API versions; read whichever is there. */
export function periodEndOf(sub: Stripe.Subscription): Date | null {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const fromItems = sub.items?.data
    ?.map((i) => (i as unknown as { current_period_end?: number }).current_period_end)
    .filter((n): n is number => typeof n === "number");
  const secs = typeof legacy === "number" ? legacy : fromItems?.length ? Math.max(...fromItems) : null;
  return secs ? new Date(secs * 1000) : null;
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : v?.id ?? null);

/** Stores the subscription's current state against the right user. */
async function saveFromStripe(
  deps: BillingDeps,
  sub: Stripe.Subscription,
  hintUserId?: string | null,
  overrideStatus?: SubscriptionRecord["status"],
): Promise<SubscriptionRecord["status"]> {
  const customerId = idOf(sub.customer as string | { id: string });
  if (!customerId) throw new Error(`Subscription ${sub.id} has no customer`);

  const userId =
    hintUserId || sub.metadata?.user_id || (await deps.store.getByCustomer(customerId))?.userId || null;
  if (!userId) {
    // Not one of ours (e.g. a different product on the same Stripe account). Ignore without failing the webhook.
    deps.log?.("stripe: subscription with no matching user, skipped", { sub: sub.id, customerId });
    return null;
  }

  const status = overrideStatus ?? mapStripeStatus(sub.status);
  await deps.store.saveSubscription({
    userId,
    stripeCustomerId: customerId,
    stripeSubscriptionId: sub.id,
    status,
    priceId: sub.items?.data?.[0]?.price?.id ?? null,
    currentPeriodEnd: periodEndOf(sub),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
  });
  return status;
}

/** The subscription id on an invoice, for both the old (`invoice.subscription`) and new (`invoice.parent`) API shapes. */
export function subscriptionIdOfInvoice(inv: Stripe.Invoice): string | null {
  const legacy = (inv as unknown as { subscription?: string | { id: string } | null }).subscription;
  const parent = (inv as unknown as { parent?: { subscription_details?: { subscription?: string | { id: string } } } })
    .parent?.subscription_details?.subscription;
  return idOf(legacy ?? parent ?? null);
}

/** Events we act on. Anything else is acknowledged (200) and ignored. */
export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
  // Not in the brief's list, but it is what moves someone from past_due back to active after they fix their card,
  // so access returns the moment the retry succeeds. Add it to the webhook endpoint in Stripe too.
  "invoice.paid",
] as const;

export type WebhookResult = { status: number; body: Record<string, unknown> };

/**
 * Verifies the signature on the raw body and applies the event.
 * Returns 400 for a bad signature (Stripe will not retry), 500 for a processing error (Stripe retries), 200 otherwise.
 */
export async function handleWebhook(deps: BillingDeps, rawBody: string, signature: string | null): Promise<WebhookResult> {
  if (!signature) return { status: 400, body: { error: "Missing Stripe-Signature header" } };

  let event: Stripe.Event;
  try {
    event = await deps.stripe.webhooks.constructEventAsync(
      rawBody,
      signature,
      deps.config.stripeWebhookSecret,
      undefined,
      cryptoProvider,
    );
  } catch (err) {
    deps.log?.("stripe: webhook signature check failed", (err as Error).message);
    return { status: 400, body: { error: "Invalid signature" } };
  }

  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) {
    return { status: 200, body: { received: true, ignored: event.type } };
  }
  if (await deps.store.wasProcessed(event.id)) {
    return { status: 200, body: { received: true, duplicate: true } };
  }

  try {
    const result = await applyEvent(deps, event);
    await deps.store.markProcessed(event.id, event.type);
    return { status: 200, body: { received: true, type: event.type, status: result } };
  } catch (err) {
    deps.log?.(`stripe: failed to process ${event.type} ${event.id}`, err);
    return { status: 500, body: { error: "Processing failed, Stripe will retry" } };
  }
}

async function applyEvent(deps: BillingDeps, event: Stripe.Event): Promise<SubscriptionRecord["status"]> {
  const { stripe } = deps;
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") return null;
      const subId = idOf(session.subscription as string | { id: string } | null);
      if (!subId) return null;
      const sub = await stripe.subscriptions.retrieve(subId);
      return saveFromStripe(deps, sub, session.client_reference_id ?? session.metadata?.user_id);
    }

    case "customer.subscription.updated": {
      // Re-read so a delayed "updated" can't overwrite a newer state.
      const stale = event.data.object as Stripe.Subscription;
      const sub = await stripe.subscriptions.retrieve(stale.id);
      return saveFromStripe(deps, sub);
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      return saveFromStripe(deps, sub, null, "cancelled");
    }

    case "invoice.payment_failed": {
      const subId = subscriptionIdOfInvoice(event.data.object as Stripe.Invoice);
      if (!subId) return null;
      const sub = await stripe.subscriptions.retrieve(subId);
      // A failed renewal means no access, even in the moment before Stripe flips the subscription to past_due.
      const status = sub.status === "active" || sub.status === "trialing" ? "past_due" : mapStripeStatus(sub.status);
      return saveFromStripe(deps, sub, null, status);
    }

    case "invoice.paid": {
      const subId = subscriptionIdOfInvoice(event.data.object as Stripe.Invoice);
      if (!subId) return null;
      return saveFromStripe(deps, await stripe.subscriptions.retrieve(subId));
    }

    default:
      return null;
  }
}

/**
 * Called by the success page. Reads the Checkout Session straight from Stripe and stores the result, so the
 * subscriber has access immediately even if the webhook is still on its way. Only works for the session's own user.
 */
export async function confirmCheckout(
  deps: BillingDeps,
  user: AuthUser,
  sessionId: string,
): Promise<{ ok: boolean; status: SubscriptionRecord["status"] }> {
  if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(sessionId)) return { ok: false, status: null };
  const session = await deps.stripe.checkout.sessions.retrieve(sessionId);
  if (session.client_reference_id !== user.id) return { ok: false, status: null };
  const subId = idOf(session.subscription as string | { id: string } | null);
  if (!subId) return { ok: false, status: null };
  const status = await saveFromStripe(deps, await deps.stripe.subscriptions.retrieve(subId), user.id);
  return { ok: true, status };
}

/** "$9.99/month", read from the Stripe price so the button follows STRIPE_PRICE_INSTANT_IMPACT. Cached for 10 minutes. */
let priceCache: { id: string; label: string; at: number } | null = null;
export async function priceLabel(deps: BillingDeps, fallback = "$9.99/month"): Promise<string> {
  const id = deps.config.priceInstantImpact;
  if (priceCache && priceCache.id === id && Date.now() - priceCache.at < 600_000) return priceCache.label;
  try {
    const price = await deps.stripe.prices.retrieve(id);
    if (price.unit_amount === null) return fallback;
    const amount = new Intl.NumberFormat("en-US", { style: "currency", currency: price.currency.toUpperCase() }).format(
      price.unit_amount / 100,
    );
    const r = price.recurring;
    const every = r ? (r.interval_count > 1 ? `${r.interval_count} ${r.interval}s` : r.interval) : null;
    const label = every ? `${amount}/${every}` : amount;
    priceCache = { id, label, at: Date.now() };
    return label;
  } catch (err) {
    deps.log?.("stripe: could not read price", (err as Error).message);
    return fallback;
  }
}
