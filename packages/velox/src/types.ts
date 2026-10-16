// Velox V1 data model. Every time is a Unix timestamp in seconds, UTC.

/** One closed candle. `time` is when the candle OPENED. */
export type Candle = {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume?: number
}

export type Timeframe = `5m` | `15m` | `1h` | `4h` | `1d`

/** Which market and feed a result belongs to. Different providers give different candles, so it is always recorded. */
export type Instrument = {
  symbol: string
  provider: string
  timeframe: Timeframe
  /** Decimal places prices are quoted to, e.g. 2 for XAUUSD. */
  pricePrecision: number
}

export type SwingKind = `high` | `low`

/**
 * A confirmed swing. `time` is the candle where the swing happened; `confirmedAt` is the close of the
 * candle that proved it (`swingLength` candles later). Nothing may use a swing before `confirmedAt`.
 */
export type Swing = {
  id: string
  kind: SwingKind
  price: number
  time: number
  index: number
  confirmedAt: number
  confirmedIndex: number
}

export type ZoneType = `supply` | `demand`

/**
 * fresh     confirmed, and price has not come back to it
 * tested    price has come back into it at least once (see `touches`)
 * mitigated price has traded through at least `mitigationDepth` of its height
 * invalid   a candle has closed beyond its far edge (plus `invalidationATR`)
 */
export type ZoneStatus = `fresh` | `tested` | `mitigated` | `invalid`

/** One line of the score breakdown, so every point in a zone's strength can be explained. */
export type ScoreFactor = {
  key: `displacement` | `structure` | `base` | `speed` | `timeframe` | `freshness`
  label: string
  points: number
  max: number
  detail: string
}

export type ZoneEvent = {
  time: number
  kind: `touch` | `left` | `mitigated` | `invalidated`
}

export type SupplyDemandZone = {
  /** Stable: the same candles and settings always give the same id. */
  id: string
  type: ZoneType
  symbol: string
  provider: string
  timeframe: Timeframe

  /** For demand, `high` is the proximal (near) edge and `low` the distal (far) edge; the reverse for supply. */
  high: number
  low: number

  /** Open time of the first base candle: where the chart may start drawing the zone. */
  originTime: number
  /** Open time of the last base candle. */
  baseEndTime: number
  /** Close time of the candle on which the zone was confirmed. Before this, the zone did not exist. */
  confirmedAt: number

  /** Strength when confirmed. Never changes afterwards. */
  strengthAtConfirmation: number
  /** Current strength: the confirmation score with freshness updated for touches and status. */
  strength: number
  score: ScoreFactor[]

  status: ZoneStatus
  statusChangedAt: number
  touches: number
  events: ZoneEvent[]

  source: {
    swingId: string
    /** Largest close beyond the near edge within the departure window, in ATRs at the base. */
    displacementATR: number
    /** Candles after the base before the displacement threshold was reached. */
    departureBars: number
    baseCandles: number
    /** The opposite swing the departure closed beyond, if it did by confirmation. */
    brokeStructure: { swingId: string; price: number } | null
    atr: number
  }

  engineVersion: string
}

export type SignalSide = `buy` | `sell`

/**
 * A rule-based entry at a zone, with a stop and a target. The target is always 1:1 with the stop:
 * takeProfit = entry ± (entry − stopLoss).
 */
export type Signal = {
  id: string
  zoneId: string
  side: SignalSide
  /** Open time of the candle on which price first came back into the zone. */
  time: number
  entry: number
  stopLoss: number
  takeProfit: number
  risk: number
  outcome: `open` | `tp` | `sl`
  closedAt: number | null
  engineVersion: string
}

/** A swing that has been confirmed but whose departure has not yet been strong enough. Not a zone. */
export type DevelopingZone = {
  type: ZoneType
  swingId: string
  high: number
  low: number
  originTime: number
  expiresAfter: number
}

export type VeloxState = {
  engine: `velox`
  engineVersion: string
  settingsHash: string
  instrument: Instrument
  /** Close time of the last candle processed. Every item in this state was known by then. */
  asOf: number | null
  candles: number
  swings: Swing[]
  zones: SupplyDemandZone[]
  developing: DevelopingZone[]
  signals: Signal[]
}
