// Runs the real migration and the Postgres store against a database.
// Skipped unless TEST_DATABASE_URL points at a throwaway Postgres (it drops and recreates the tables), e.g.
//   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:54329/postgres npm test
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { after, before, describe, it } from "node:test";
import pg from "pg";
import { createAutomationApi } from "../server/router";
import { createPgBillingStore, createPgSignalsLoader } from "../server/store";
import type { Sql } from "../server/types";
import { config, inDays, makeFakeStripe, signedWebhook } from "./helpers";

const url = process.env.TEST_DATABASE_URL;

describe("Postgres store", { skip: !url && "set TEST_DATABASE_URL to run" }, () => {
  let pool: pg.Pool;
  let sql: Sql;

  before(async () => {
    pool = new pg.Pool({ connectionString: url });
    sql = { query: async (text, params) => (await pool.query(text, params as unknown[])).rows };
    await pool.query("drop table if exists public.instant_impact_subscriptions, public.stripe_webhook_events, public.signals");
    const migration = readFileSync(new URL("../migrations/001_instant_impact_billing.sql", import.meta.url), "utf8");
    await pool.query(migration);
    await pool.query(migration); // safe to run twice
    // The Trade Room signals table, as in trade-room-signals/README.md.
    await pool.query(`create table public.signals (
      id bigserial primary key, channel_id text, direction text, instrument text, entry_from numeric, entry_to numeric,
      take_profits numeric[] not null default '{}', stop_loss numeric, status text, targets_hit int not null default 0,
      notes text, created_at timestamptz not null default now())`);
    await pool.query(`insert into public.signals (channel_id, direction, instrument, entry_from, entry_to, take_profits, stop_loss, status)
      values ('vt-capital','BUY','XAUUSD',4118,4121,'{4128,4135}',4112,'active'), ('other','SELL','EURUSD',1.08,null,'{1.075}',1.085,'stop_loss')`);
  });
  after(async () => pool?.end());

  it("stores and updates subscription state through webhooks", async () => {
    const fake = makeFakeStripe();
    const store = createPgBillingStore(sql);
    const api = createAutomationApi({
      config,
      stripe: fake.stripe,
      store,
      getUser: async () => ({ id: "user_pg", email: "pg@example.com" }),
      loadSignals: createPgSignalsLoader(sql, "vt-capital"),
    });
    const res = await api(new Request("https://x/api/automation/checkout", { method: "POST" }));
    assert.equal(res!.status, 200);
    assert.equal((await store.getByUser("user_pg"))?.stripeCustomerId, "cus_1");

    fake.subs.set("sub_pg", {
      id: "sub_pg", customer: "cus_1", status: "active", cancel_at_period_end: false, metadata: {},
      items: { data: [{ price: { id: "price_instant_impact" }, current_period_end: inDays(30) }] },
    });
    // No user id in metadata: matched through the stored customer id.
    await api(await signedWebhook({ id: "evt_pg1", type: "customer.subscription.updated", data: { object: { id: "sub_pg" } } }));
    const rec = await store.getByUser("user_pg");
    assert.equal(rec?.status, "active");
    assert.ok(rec?.currentPeriodEnd instanceof Date);
    assert.equal(await store.wasProcessed("evt_pg1"), true);

    const feed = await (await api(new Request("https://x/api/automation/signals")))!.json();
    assert.equal(feed.locked, false);
    assert.equal(feed.signals.length, 1, "only the configured channel");
    assert.deepEqual(feed.signals[0].takeProfits, [4128, 4135]);

    fake.subs.get("sub_pg")!.status = "past_due";
    await api(await signedWebhook({ id: "evt_pg2", type: "invoice.payment_failed", data: { object: { subscription: "sub_pg" } } }));
    assert.equal((await store.getByUser("user_pg"))?.status, "past_due");
    assert.equal((await (await api(new Request("https://x/api/automation/signals")))!.json()).locked, true);
  });
});
