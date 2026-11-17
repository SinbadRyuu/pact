// Server exports and one-call setup from env.
export { createRankingsApi, readRankingsConfig, tradesCsv, type RankingsConfig } from "./router";
export { createMemoryRankingsStore, createPgRankingsStore, type RankingsStore } from "./store";
export { computeStats, equityCurve, monthlyBreakdown, rankProviders } from "./stats";
export type * from "./types";

import { createRankingsApi, readRankingsConfig } from "./router";
import { createPgRankingsStore } from "./store";
import type { Sql } from "./types";

export function createRankingsApiFromEnv(env: Record<string, string | undefined>, sql: Sql) {
  return createRankingsApi({
    store: createPgRankingsStore(sql),
    config: readRankingsConfig(env),
    log: (m, e) => console.error(`[rankings] ${m}`, e ?? ""),
  });
}
