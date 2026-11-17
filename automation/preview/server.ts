// Preview server: the REAL API router with a fake Stripe and an in-memory store, plus the built page.
// The bar at the bottom of the page switches who you are (signed out / signed in / subscribed / payment failed / cancelled).
//   npm run preview   then open http://localhost:4310/automation
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { createAutomationApi } from "../server/router";
import { toNodeHandler } from "../server/node";
import { createMemoryBillingStore } from "../server/store";
import type { SubscriptionRecord } from "../server/types";
import { config, makeFakeStripe, SIGNALS } from "../test/helpers";

const fake = makeFakeStripe();
const store = createMemoryBillingStore();
const period = new Date(Date.now() + 21 * 86_400_000);
const rec = (status: SubscriptionRecord["status"], cancelAtPeriodEnd = false): SubscriptionRecord => ({
  userId: "preview",
  stripeCustomerId: "cus_preview",
  stripeSubscriptionId: "sub_preview",
  status,
  priceId: "price_instant_impact",
  currentPeriodEnd: period,
  cancelAtPeriodEnd,
  updatedAt: new Date(),
});

const now = Date.now();
const signals = [
  { ...SIGNALS[0], createdAt: new Date(now - 4 * 60_000).toISOString(), notes: "Buying the London retest. Partial at TP1, stop to entry." },
  { ...SIGNALS[0], id: "s2", pair: "GBPJPY", direction: "SELL" as const, entryFrom: 198.42, entryTo: null, takeProfits: [197.9, 197.4, 196.8], stopLoss: 198.9, status: "take_profit", targetsHit: 2, createdAt: new Date(now - 3 * 3600_000).toISOString() },
  { ...SIGNALS[0], id: "s3", pair: "NAS100", entryFrom: 21040, entryTo: 21060, takeProfits: [21120, 21200], stopLoss: 20960, status: "stop_loss", targetsHit: 0, createdAt: new Date(now - 26 * 3600_000).toISOString() },
];

const api = createAutomationApi({
  config: { ...config, siteUrl: "http://localhost:4310" },
  stripe: fake.stripe,
  store,
  getUser: async (req) => {
    const who = /preview_as=([a-z_]+)/.exec(req.headers.get("cookie") ?? "")?.[1] ?? "signed_out";
    if (who === "signed_out") return null;
    const map: Record<string, SubscriptionRecord | null> = {
      signed_in: null,
      subscribed: rec("active"),
      cancelling: rec("active", true),
      payment_failed: rec("past_due"),
      cancelled: rec("cancelled"),
    };
    // "signed_in" = has an account but never subscribed.
    await store.saveSubscription(map[who] ?? { ...rec(null), stripeSubscriptionId: null, currentPeriodEnd: null });
    return { id: "preview", email: "preview@example.com" };
  },
  loadSignals: async () => signals,
});
const node = toNodeHandler(api);

createServer((req, res) => {
  if (req.url?.startsWith("/api/")) return node(req, res);
  if (req.url?.startsWith("/dist/")) {
    const file = new URL(`./${req.url.split("?")[0]}`, import.meta.url);
    res.setHeader("content-type", file.pathname.endsWith(".css") ? "text/css" : "text/javascript");
    return res.end(readFileSync(file));
  }
  res.setHeader("content-type", "text/html");
  res.end(readFileSync(new URL("./index.html", import.meta.url)));
}).listen(4310, () => console.log("Automation preview: http://localhost:4310/automation"));
