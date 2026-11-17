// Test helpers: a fake Stripe API (real webhook signing/verification, in-memory objects) and a ready API instance.
import Stripe from "stripe";
import type { AutomationConfig } from "../server/config";
import { createAutomationApi } from "../server/router";
import { createMemoryBillingStore } from "../server/store";
import type { AuthUser, FeedSignal } from "../server/types";

export const WEBHOOK_SECRET = "whsec_test_secret_for_unit_tests";

export const config: AutomationConfig = {
  stripeSecretKey: "sk_test_unit",
  stripeWebhookSecret: WEBHOOK_SECRET,
  priceInstantImpact: "price_instant_impact",
  siteUrl: "https://vtimpact.test",
  telegramSignalsLink: "https://t.me/+subscribersOnly",
  vtMarketsSignupLink: "https://vtm.example/ib",
  sniperBotCopyLink: "https://vtm.example/copy/sniper",
  sniperBotAppLink: "vtmarkets://copytrading/strategy/sniper",
  vtMarketsAndroidPackage: null,
  crucialMarketsLink: "https://crucial.example",
  instantImpactChannelId: null,
  graceDays: 0,
};

const real = new Stripe("sk_test_unit");

export interface FakeSub {
  id: string;
  customer: string;
  status: string;
  cancel_at_period_end: boolean;
  metadata: Record<string, string>;
  items: { data: { price: { id: string }; current_period_end: number }[] };
}

export function makeFakeStripe() {
  const subs = new Map<string, FakeSub>();
  const sessions = new Map<string, { id: string; client_reference_id: string; subscription: string | null; mode: string }>();
  let customerSeq = 0;
  const calls = { customersCreated: 0, checkoutCreated: [] as unknown[] };

  const stripe = {
    webhooks: real.webhooks,
    customers: {
      create: async () => {
        calls.customersCreated++;
        return { id: `cus_${++customerSeq}` };
      },
    },
    checkout: {
      sessions: {
        create: async (params: unknown) => {
          calls.checkoutCreated.push(params);
          return { id: "cs_test_new", url: "https://checkout.stripe.test/c/pay/cs_test_new" };
        },
        retrieve: async (id: string) => {
          const s = sessions.get(id);
          if (!s) throw new Error("No such session");
          return s;
        },
      },
    },
    billingPortal: { sessions: { create: async () => ({ url: "https://billing.stripe.test/p/session" }) } },
    subscriptions: {
      retrieve: async (id: string) => {
        const s = subs.get(id);
        if (!s) throw new Error("No such subscription");
        return structuredClone(s);
      },
    },
    prices: {
      retrieve: async () => ({ unit_amount: 999, currency: "usd", recurring: { interval: "month", interval_count: 1 } }),
    },
  } as unknown as Stripe;

  return { stripe, subs, sessions, calls };
}

/** A signed webhook request exactly as Stripe would send it. */
export async function signedWebhook(event: { id: string; type: string; data: { object: unknown } }, secret = WEBHOOK_SECRET) {
  const payload = JSON.stringify({ object: "event", api_version: "2025-10-29.clover", created: Math.floor(Date.now() / 1000), ...event });
  const header = await real.webhooks.generateTestHeaderStringAsync({ payload, secret });
  return new Request("https://vtimpact.test/api/automation/webhook", {
    method: "POST",
    headers: { "stripe-signature": header, "content-type": "application/json" },
    body: payload,
  });
}

export const SIGNALS: FeedSignal[] = [
  {
    id: "s1",
    pair: "XAUUSD",
    direction: "BUY",
    entryFrom: 4118,
    entryTo: 4121,
    takeProfits: [4128, 4135],
    stopLoss: 4112,
    status: "active",
    targetsHit: 0,
    notes: null,
    createdAt: "2026-11-17T09:00:00.000Z",
  },
];

export function setup(opts: { now?: () => Date; graceDays?: number } = {}) {
  const fake = makeFakeStripe();
  const store = createMemoryBillingStore();
  const users = new Map<string, AuthUser>([
    ["tok_alice", { id: "user_alice", email: "alice@example.com" }],
    ["tok_bob", { id: "user_bob", email: "bob@example.com" }],
  ]);
  const api = createAutomationApi({
    config: { ...config, graceDays: opts.graceDays ?? 0 },
    stripe: fake.stripe,
    store,
    getUser: async (req) => users.get((req.headers.get("authorization") ?? "").replace(/^Bearer /, "")) ?? null,
    loadSignals: async () => SIGNALS,
    now: opts.now,
  });
  const call = async (method: string, path: string, token?: string) => {
    const res = await api(
      new Request(`https://vtimpact.test${path}`, {
        method,
        headers: token ? { authorization: `Bearer ${token}` } : {},
      }),
    );
    if (!res) throw new Error(`not handled: ${path}`);
    return { status: res.status, body: (await res.json()) as Record<string, any> };
  };
  return { api, store, call, ...fake };
}

export const inDays = (d: number, from = Date.now()) => Math.floor((from + d * 86_400_000) / 1000);
