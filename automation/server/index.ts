// Everything the server side exports, plus `createAutomationApiFromEnv` for the common setup
// (Stripe from env, Postgres store, Supabase auth). See README, "Mount the API".
export { hasInstantImpactAccess, mapStripeStatus } from "./access";
export { createStripeClient, handleWebhook, HANDLED_EVENTS } from "./billing";
export { readAutomationConfig, stripeModeWarnings, type AutomationConfig } from "./config";
export { createAutomationApi, type AutomationApiDeps } from "./router";
export { createMemoryBillingStore, createPgBillingStore, createPgSignalsLoader, type BillingStore } from "./store";
export { supabaseGetUser } from "./supabaseAuth";
export type * from "./types";

import { createStripeClient } from "./billing";
import { readAutomationConfig, stripeModeWarnings } from "./config";
import { createAutomationApi } from "./router";
import { createPgBillingStore, createPgSignalsLoader } from "./store";
import type { GetUser, Sql } from "./types";

/** One-call setup: reads env, wires Stripe, Postgres and your auth. */
export function createAutomationApiFromEnv(env: Record<string, string | undefined>, sql: Sql, getUser: GetUser) {
  const config = readAutomationConfig(env);
  for (const w of stripeModeWarnings(config)) console.warn(`[automation] ${w}`);
  return createAutomationApi({
    config,
    stripe: createStripeClient(config.stripeSecretKey),
    store: createPgBillingStore(sql),
    loadSignals: createPgSignalsLoader(sql, config.instantImpactChannelId),
    getUser,
    log: (m, e) => console.error(`[automation] ${m}`, e ?? ""),
  });
}
