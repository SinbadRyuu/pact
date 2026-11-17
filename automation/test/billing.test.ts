// Stripe flow and server-side gating. Run: npm test
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasInstantImpactAccess } from "../server/access";
import { inDays, setup, signedWebhook, type FakeSub } from "./helpers";

function activeSub(over: Partial<FakeSub> = {}): FakeSub {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    cancel_at_period_end: false,
    metadata: { user_id: "user_alice" },
    items: { data: [{ price: { id: "price_instant_impact" }, current_period_end: inDays(30) }] },
    ...over,
  };
}

/** Alice subscribes: Checkout, then Stripe sends checkout.session.completed. */
async function subscribeAlice(t: ReturnType<typeof setup>) {
  const r = await t.call("POST", "/api/automation/checkout", "tok_alice");
  assert.equal(r.status, 200);
  t.subs.set("sub_1", activeSub());
  t.sessions.set("cs_test_abc", { id: "cs_test_abc", client_reference_id: "user_alice", subscription: "sub_1", mode: "subscription" });
  const res = await t.api(
    await signedWebhook({
      id: "evt_checkout",
      type: "checkout.session.completed",
      data: { object: { id: "cs_test_abc", mode: "subscription", client_reference_id: "user_alice", subscription: "sub_1", metadata: {} } },
    }),
  );
  assert.equal(res!.status, 200);
}

describe("checkout", () => {
  it("sends signed-out visitors to sign in, then back to /automation/subscribe", async () => {
    const t = setup();
    const r = await t.call("POST", "/api/automation/checkout");
    assert.equal(r.status, 401);
    assert.equal(r.body.next, "/automation/subscribe");
  });

  it("creates a subscription-mode Checkout Session with the price from env and the user id attached", async () => {
    const t = setup();
    const r = await t.call("POST", "/api/automation/checkout", "tok_alice");
    assert.equal(r.status, 200);
    assert.match(r.body.url, /^https:\/\/checkout\.stripe\.test/);
    const p = t.calls.checkoutCreated[0] as any;
    assert.equal(p.mode, "subscription");
    assert.deepEqual(p.line_items, [{ price: "price_instant_impact", quantity: 1 }]);
    assert.equal(p.client_reference_id, "user_alice");
    assert.equal(p.subscription_data.metadata.user_id, "user_alice");
    assert.equal(p.success_url, "https://vtimpact.test/automation/success?session_id={CHECKOUT_SESSION_ID}");
  });

  it("reuses the same Stripe customer on a second attempt", async () => {
    const t = setup();
    await t.call("POST", "/api/automation/checkout", "tok_alice");
    await t.call("POST", "/api/automation/checkout", "tok_alice");
    assert.equal(t.calls.customersCreated, 1);
  });

  it("refuses a second subscription for someone who already has access", async () => {
    const t = setup();
    await subscribeAlice(t);
    const r = await t.call("POST", "/api/automation/checkout", "tok_alice");
    assert.equal(r.status, 409);
  });
});

describe("webhooks", () => {
  it("rejects a bad signature and changes nothing", async () => {
    const t = setup();
    const req = await signedWebhook(
      { id: "evt_x", type: "customer.subscription.deleted", data: { object: activeSub() } },
      "whsec_wrong_secret",
    );
    const res = await t.api(req);
    assert.equal(res!.status, 400);
    assert.equal(t.store.all().length, 0);
  });

  it("rejects a request with no signature", async () => {
    const t = setup();
    const res = await t.api(new Request("https://vtimpact.test/api/automation/webhook", { method: "POST", body: "{}" }));
    assert.equal(res!.status, 400);
  });

  it("checkout.session.completed stores active + period end against the user", async () => {
    const t = setup();
    await subscribeAlice(t);
    const rec = await t.store.getByUser("user_alice");
    assert.equal(rec?.status, "active");
    assert.equal(rec?.stripeSubscriptionId, "sub_1");
    assert.equal(rec?.priceId, "price_instant_impact");
    assert.ok(rec?.currentPeriodEnd && rec.currentPeriodEnd.getTime() > Date.now());
  });

  it("ignores a duplicate delivery of the same event", async () => {
    const t = setup();
    await subscribeAlice(t);
    const again = await t.api(
      await signedWebhook({
        id: "evt_checkout",
        type: "checkout.session.completed",
        data: { object: { mode: "subscription", client_reference_id: "user_alice", subscription: "sub_1" } },
      }),
    );
    assert.equal((await again!.json()).duplicate, true);
  });

  it("acknowledges events it doesn't handle", async () => {
    const t = setup();
    const res = await t.api(await signedWebhook({ id: "evt_o", type: "customer.created", data: { object: {} } }));
    assert.equal(res!.status, 200);
  });

  it("uses Stripe's current state when an old 'updated' event arrives late", async () => {
    const t = setup();
    await subscribeAlice(t);
    t.subs.set("sub_1", activeSub({ status: "canceled" })); // what Stripe says now
    await t.api(
      await signedWebhook({ id: "evt_late", type: "customer.subscription.updated", data: { object: activeSub() } }),
    );
    assert.equal((await t.store.getByUser("user_alice"))?.status, "cancelled");
  });
});

describe("server-side gating", () => {
  it("signed-out and unsubscribed visitors get no signal data and no Telegram link", async () => {
    const t = setup();
    for (const token of [undefined, "tok_bob"]) {
      const s = await t.call("GET", "/api/automation/signals", token);
      assert.equal(s.body.locked, true);
      assert.deepEqual(s.body.signals, []);
      assert.equal(s.body.telegramLink, undefined);
      const st = await t.call("GET", "/api/automation/state", token);
      assert.equal(st.body.hasAccess, false);
      assert.equal(st.body.telegramLink, null);
    }
  });

  it("subscribers get the feed and the Telegram link", async () => {
    const t = setup();
    await subscribeAlice(t);
    const s = await t.call("GET", "/api/automation/signals", "tok_alice");
    assert.equal(s.body.locked, false);
    assert.equal(s.body.signals.length, 1);
    assert.equal(s.body.telegramLink, "https://t.me/+subscribersOnly");
    const st = await t.call("GET", "/api/automation/state", "tok_alice");
    assert.equal(st.body.priceLabel, "$9.99/month");
    assert.equal(st.body.canManage, true);
  });

  it("a failed payment locks the feed, and a successful retry unlocks it", async () => {
    const t = setup();
    await subscribeAlice(t);

    // Old API shape: invoice.subscription
    await t.api(
      await signedWebhook({ id: "evt_fail", type: "invoice.payment_failed", data: { object: { id: "in_1", subscription: "sub_1" } } }),
    );
    assert.equal((await t.store.getByUser("user_alice"))?.status, "past_due");
    assert.equal((await t.call("GET", "/api/automation/signals", "tok_alice")).body.locked, true);
    assert.equal((await t.call("GET", "/api/automation/state", "tok_alice")).body.canManage, true);

    // New API shape: invoice.parent.subscription_details.subscription
    t.subs.set("sub_1", activeSub());
    await t.api(
      await signedWebhook({
        id: "evt_paid",
        type: "invoice.paid",
        data: { object: { id: "in_2", parent: { subscription_details: { subscription: "sub_1" } } } },
      }),
    );
    assert.equal((await t.call("GET", "/api/automation/signals", "tok_alice")).body.locked, false);
  });

  it("cancelling at period end keeps access until the period ends, then locks", async () => {
    let now = new Date();
    const t = setup({ now: () => now });
    await subscribeAlice(t);
    const end = inDays(10);
    t.subs.set("sub_1", activeSub({ cancel_at_period_end: true, items: { data: [{ price: { id: "price_instant_impact" }, current_period_end: end }] } }));
    await t.api(await signedWebhook({ id: "evt_upd", type: "customer.subscription.updated", data: { object: activeSub() } }));

    const st = await t.call("GET", "/api/automation/state", "tok_alice");
    assert.equal(st.body.subscription.cancelAtPeriodEnd, true);
    assert.equal((await t.call("GET", "/api/automation/signals", "tok_alice")).body.locked, false);

    now = new Date(end * 1000 + 86_400_000); // a day after the period ended, before the deleted webhook lands
    assert.equal((await t.call("GET", "/api/automation/signals", "tok_alice")).body.locked, true);
  });

  it("customer.subscription.deleted locks the feed immediately", async () => {
    const t = setup();
    await subscribeAlice(t);
    await t.api(
      await signedWebhook({ id: "evt_del", type: "customer.subscription.deleted", data: { object: activeSub({ status: "canceled" }) } }),
    );
    assert.equal((await t.store.getByUser("user_alice"))?.status, "cancelled");
    const s = await t.call("GET", "/api/automation/signals", "tok_alice");
    assert.equal(s.body.locked, true);
    assert.equal(s.body.reason, "cancelled");
  });

  it("INSTANT_IMPACT_GRACE_DAYS keeps access for a few days after a failed payment", () => {
    const end = new Date("2026-11-10T00:00:00Z");
    const rec = { userId: "u", stripeCustomerId: "c", stripeSubscriptionId: "s", status: "past_due" as const, priceId: null, currentPeriodEnd: end, cancelAtPeriodEnd: false, updatedAt: end };
    assert.equal(hasInstantImpactAccess(rec, new Date("2026-11-12T00:00:00Z"), 0), false);
    assert.equal(hasInstantImpactAccess(rec, new Date("2026-11-12T00:00:00Z"), 3), true);
    assert.equal(hasInstantImpactAccess(rec, new Date("2026-11-14T00:00:00Z"), 3), false);
  });
});

describe("success page and portal", () => {
  it("confirm grants access straight away, before the webhook lands", async () => {
    const t = setup();
    await t.call("POST", "/api/automation/checkout", "tok_alice");
    t.subs.set("sub_1", activeSub());
    t.sessions.set("cs_test_abc", { id: "cs_test_abc", client_reference_id: "user_alice", subscription: "sub_1", mode: "subscription" });
    const r = await t.call("GET", "/api/automation/checkout/confirm?session_id=cs_test_abc", "tok_alice");
    assert.equal(r.body.hasAccess, true);
    assert.equal(r.body.telegramLink, "https://t.me/+subscribersOnly");
  });

  it("confirm won't let someone claim another person's Checkout Session", async () => {
    const t = setup();
    t.subs.set("sub_1", activeSub());
    t.sessions.set("cs_test_abc", { id: "cs_test_abc", client_reference_id: "user_alice", subscription: "sub_1", mode: "subscription" });
    const r = await t.call("GET", "/api/automation/checkout/confirm?session_id=cs_test_abc", "tok_bob");
    assert.equal(r.body.ok, false);
    assert.equal(r.body.hasAccess, false);
    assert.equal(r.body.telegramLink, null);
  });

  it("portal opens for subscribers and 404s for people without a subscription", async () => {
    const t = setup();
    assert.equal((await t.call("POST", "/api/automation/portal", "tok_bob")).status, 404);
    await subscribeAlice(t);
    const r = await t.call("POST", "/api/automation/portal", "tok_alice");
    assert.match(r.body.url, /billing\.stripe\.test/);
  });
});
