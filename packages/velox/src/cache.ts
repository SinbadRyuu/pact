import { stableHash } from './hash.ts'
import { resolveSettings, ENGINE_VERSION, type VeloxSettingsInput } from './settings.ts'
import type { Instrument } from './types.ts'

/** Server cache key: a result is reusable only for the same feed, market, timeframe, settings and engine version. */
export function cacheKey(instrument: Instrument, settings: VeloxSettingsInput = {}): string {
  return [`velox`, ENGINE_VERSION, instrument.provider, instrument.symbol, instrument.timeframe, stableHash(resolveSettings(settings))].join(`:`)
}
