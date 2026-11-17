// Server exports and a one-call setup from env.
export { createIndicatorsApi, defaultInstallSteps, PLATFORMS, type IndicatorDetail, type IndicatorSummary } from "./router";
export { createMemoryIndicatorStore, createPgIndicatorStore, type IndicatorStore } from "./store";
export { passthroughSigner, supabaseStorageSigner } from "./files";
export { legacyChartRedirect, LEGACY_CHART_PATHS } from "./legacyRedirect";
export { supabaseGetUser } from "./supabaseAuth";
export type * from "./types";

import { passthroughSigner, supabaseStorageSigner } from "./files";
import { createIndicatorsApi } from "./router";
import { createPgIndicatorStore } from "./store";
import type { AuthUser, GetUser, Sql } from "./types";

/**
 * Same rule as the Automation page: an active or trialing Instant Impact subscription whose period hasn't ended.
 * Only used when INDICATORS_MEMBERS_REQUIRE_SUBSCRIPTION=true.
 */
export function pgInstantImpactSubscriber(sql: Sql) {
  return async (user: AuthUser) => {
    const rows = await sql.query(
      `select 1 from public.instant_impact_subscriptions
        where user_id = $1 and status in ('active', 'trialing')
          and (current_period_end is null or current_period_end > now() - interval '6 hours')`,
      [user.id],
    );
    return rows.length > 0;
  };
}

export function createIndicatorsApiFromEnv(env: Record<string, string | undefined>, sql: Sql, getUser: GetUser) {
  const signFile =
    env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY
      ? supabaseStorageSigner({ supabaseUrl: env.SUPABASE_URL, serviceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY })
      : passthroughSigner;
  return createIndicatorsApi({
    store: createPgIndicatorStore(sql),
    getUser,
    signFile,
    isSubscriber: env.INDICATORS_MEMBERS_REQUIRE_SUBSCRIPTION === "true" ? pgInstantImpactSubscriber(sql) : undefined,
    log: (m, e) => console.error(`[indicators] ${m}`, e ?? ""),
  });
}
