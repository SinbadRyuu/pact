// End-to-end check against REAL Stripe test mode (never live). Exercises the actual API router with real Stripe
// objects and real events, using a Stripe test clock so a renewal can fail without waiting a month.
//
//   STRIPE_SECRET_KEY=sk_test_… STRIPE_PRICE_INSTANT_IMPACT=price_… npm run stripe:e2e
//
// What it does
//  1. POST /checkout for a test user → a real Checkout Session URL (subscription mode, your price).
//  2. Subscribes that customer with Stripe's test card (what Checkout would do once paid) and delivers the real
//     checkout/subscription events to POST /webhook, signed → feed unlocked.
//  3. Swaps the card for one that always declines and advances the test clock past the renewal → Stripe really
//     fails the invoice; the real invoice.payment_failed event is delivered → feed locked.
//  4. Cancels the subscription → real customer.subscription.deleted → feed stays locked, status "cancelled".
// Everything it creates lives on a test clock and is deleted at the end.
import Stripe from "stripe";
import { createAutomationApi } from "../server/router";
import { createMemoryBillingStore } from "../server/store";

const key = process.env.STRIPE_SECRET_KEY ?? "";
const price = process.env.STRIPE_PRICE_INSTANT_IMPACT ?? "";
if (!key.startsWith("sk_test_")) throw new Error("Set STRIPE_SECRET_KEY to a TEST key (sk_test_…). This script refuses live keys.");
if (!price.startsWith("price_")) throw new Error("Set STRIPE_PRICE_INSTANT_IMPACT to your test-mode price_… id.");

const stripe = new Stripe(key);
const secret = "whsec_local_e2e_only"; // events are re-signed locally, so no endpoint needs to exist
const store = createMemoryBillingStore();
const user = { id: `e2e_${Date.now()}`, email: "e2e-test@example.com" };
const api = createAutomationApi({
  config: {
    stripeSecretKey: key, stripeWebhookSecret: secret, priceInstantImpact: price, siteUrl: "https://vtimpact.com",
    telegramSignalsLink: "https://t.me/+e2e", vtMarketsSignupLink: null, sniperBotCopyLink: null, sniperBotAppLink: null,
    vtMarketsAndroidPackage: null, crucialMarketsLink: null, instantImpactChannelId: null, graceDays: 0,
  },
  stripe, store, getUser: async () => user, loadSignals: async () => [],
});

const call = async (method: string, path: string) => {
  const res = (await api(new Request(`https://vtimpact.com/api/automation${path}`, { method })))!;
  return { status: res.status, body: await res.json() };
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const step = (msg: string) => console.log(`\n▶ ${msg}`);
const check = (ok: boolean, msg: string) => {
  console.log(`  ${ok ? "✔" : "✘"} ${msg}`);
  if (!ok) process.exitCode = 1;
};

/** Delivers every real Stripe event for this customer since `since` to our webhook, signed like Stripe does. */
async function deliverEvents(customer: string, since: number, types: string[]) {
  const seen = new Set<string>();
  for (let i = 0; i < 10; i++) {
    const { data } = await stripe.events.list({ created: { gte: since }, limit: 100, types });
    const mine = data
      .filter((e) => JSON.stringify(e.data.object).includes(customer) && !seen.has(e.id))
      .sort((a, b) => a.created - b.created);
    for (const e of mine) {
      seen.add(e.id);
      const payload = JSON.stringify(e);
      const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret });
      const res = await api(new Request("https://vtimpact.com/api/automation/webhook", { method: "POST", headers: { "stripe-signature": header }, body: payload }));
      console.log(`  ↳ ${e.type} → ${res!.status}`);
    }
    if (mine.length) return;
    await sleep(2000);
  }
}

async function waitForClock(id: string) {
  for (;;) {
    const c = await stripe.testHelpers.testClocks.retrieve(id);
    if (c.status === "ready") return;
    await sleep(2000);
  }
}

const start = Math.floor(Date.now() / 1000) - 5;
const clock = await stripe.testHelpers.testClocks.create({ frozen_time: Math.floor(Date.now() / 1000), name: "vtimpact e2e" });
try {
  step("Checkout");
  const customer = await stripe.customers.create({ email: user.email, test_clock: clock.id, metadata: { user_id: user.id } });
  await store.setCustomer(user.id, customer.id);
  const co = await call("POST", "/checkout");
  check(co.status === 200 && String(co.body.url).startsWith("https://checkout.stripe.com/"), `Checkout Session created: ${co.body.url}`);
  check((await call("GET", "/signals")).body.locked === true, "feed locked before paying");

  step("Pay (test card) and deliver webhooks");
  const pm = await stripe.paymentMethods.attach("pm_card_visa", { customer: customer.id });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: pm.id } });
  const sub = await stripe.subscriptions.create({ customer: customer.id, items: [{ price }], metadata: { user_id: user.id } });
  await deliverEvents(customer.id, start, ["customer.subscription.created", "customer.subscription.updated", "invoice.paid"]);
  const s1 = await call("GET", "/state");
  check(s1.body.hasAccess === true && s1.body.subscription?.status === "active", `status active, renews ${s1.body.subscription?.currentPeriodEnd}`);
  check((await call("GET", "/signals")).body.locked === false, "feed unlocked");
  check((await call("POST", "/portal")).body.url?.startsWith("https://billing.stripe.com/"), "Customer Portal opens");

  step("Renewal payment fails");
  const bad = await stripe.paymentMethods.attach("pm_card_chargeCustomerFail", { customer: customer.id });
  await stripe.customers.update(customer.id, { invoice_settings: { default_payment_method: bad.id } });
  await stripe.subscriptions.update(sub.id, { default_payment_method: bad.id });
  const before = Math.floor(Date.now() / 1000) - 5;
  const periodEnd = (await stripe.subscriptions.retrieve(sub.id)).items.data[0].current_period_end;
  await stripe.testHelpers.testClocks.advance(clock.id, { frozen_time: periodEnd + 3 * 3600 });
  await waitForClock(clock.id);
  await deliverEvents(customer.id, before, ["invoice.payment_failed", "customer.subscription.updated"]);
  const s2 = await call("GET", "/state");
  check(s2.body.subscription?.status === "past_due", `status ${s2.body.subscription?.status}`);
  check((await call("GET", "/signals")).body.locked === true, "feed locked after failed payment");

  step("Cancel");
  const before2 = Math.floor(Date.now() / 1000) - 5;
  await stripe.subscriptions.cancel(sub.id);
  await deliverEvents(customer.id, before2, ["customer.subscription.deleted"]);
  const s3 = await call("GET", "/state");
  check(s3.body.subscription?.status === "cancelled", `status ${s3.body.subscription?.status}`);
  check((await call("GET", "/signals")).body.locked === true, "feed locked after cancelling");
} finally {
  await stripe.testHelpers.testClocks.del(clock.id).catch(() => {});
  console.log(process.exitCode ? "\nE2E FAILED" : "\nE2E PASSED (test clock and its objects deleted)");
}
