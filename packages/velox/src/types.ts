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
 * The lifecycle shared by zones and order blocks. It only ever moves forward.
 *
 * fresh     confirmed, and no candle has reached the near (proximal) edge since
 * tested    a candle reached the near edge (one visit, however many candles stay inside)
 * mitigated a candle reached `mitigationDepth` of the way to the far (distal) edge
 * invalid   a candle closed beyond the far edge (or wicked beyond it, in `wick` invalidation mode)
 */
export type ZoneStatus = `fresh` | `tested` | `mitigated` | `invalid`

/** One line of a strength breakdown, so every point can be explained. */
export type ScoreFactor = {
  key: `displacement` | `structure` | `orderBlock` | `fvg` | `speed` | `freshness` | `timeframe` | `zone` | `impulse`
  label: string
  points: number
  max: number
  detail: string
}

export type LevelEvent = {
  time: number
  kind: `touch` | `left` | `mitigated` | `invalidated` | `breaker` | `breaker-ended`
}

/**
 * A break of structure: a candle CLOSED beyond the last confirmed, unbroken swing.
 * CHoCH when it went against the previous trend (or there was none), BOS when it went with it.
 */
export type StructureEvent = {
  id: string
  kind: `BOS` | `CHoCH`
  direction: `up` | `down`
  /** The swing price that was broken. */
  level: number
  swingId: string
  /** Open time of the breaking candle. */
  time: number
  confirmedAt: number
}

/**
 * A demand zone is the PLACE price turned from: the wick of the lowest low between the broken swing
 * high and the breaking candle ("the low that broke the high"). A supply zone is the mirror.
 */
export type SupplyDemandZone = {
  /** Stable: the same candles and settings always give the same id. */
  id: string
  type: ZoneType
  symbol: string
  provider: string
  timeframe: Timeframe

  /** For demand, `high` is the near (proximal) edge and `low` the far (distal) wick; the reverse for supply. */
  high: number
  low: number

  /** Open time of the origin candle: where the chart may start drawing the zone. */
  originTime: number
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
  events: LevelEvent[]

  source: {
    /** The break this zone launched, or null for a zone without one (`requireBOS: false`). */
    structureEventId: string | null
    /** The confirmed swing the zone sits on, for zones without a break. */
    swingId: string | null
    /** How far the break (or departure) closed beyond the near edge, in ATRs at the origin. */
    displacementATR: number
    /** Candles from the origin to the break (or to the displacement). */
    departureBars: number
    /** The order block from the same break, when it is on this zone. */
    orderBlockId: string | null
    /** A fair value gap the departure left behind, in the zone's direction, known by confirmation. */
    fvgId: string | null
    atr: number
  }
  /** Every order block that has since been found on this zone, in the order they were confirmed. */
  relatedOrderBlockIds: string[]

  engineVersion: string
}

/**
 * An order block is the CANDLE a move started from: the last down-close candle (bullish) or up-close
 * candle (bearish) at or before the origin of a move that broke structure, accepted only if that move
 * was strong enough. It is only known to be an order block once the break has closed.
 */
export type OrderBlock = {
  id: string
  type: `bullish` | `bearish`
  symbol: string
  provider: string
  timeframe: Timeframe
  high: number
  low: number
  /** Open time of the order-block candle. */
  originTime: number
  /** Close time of the breaking candle. */
  confirmedAt: number

  strengthAtConfirmation: number
  strength: number
  score: ScoreFactor[]

  status: ZoneStatus
  statusChangedAt: number
  touches: number
  events: LevelEvent[]

  /** How far the break closed beyond the order block's near edge, in ATRs. */
  displacementATR: number
  /** Strong candles in the move's direction between the order block and the break. */
  impulseCandles: number
  bosId: string
  /** The zone it sits on, if any, known at confirmation. */
  parentZoneId: string | null
  /** Set when the order block failed and became a breaker block: its role flips (support ↔ resistance). */
  breaker: { since: number; endedAt: number | null } | null

  engineVersion: string
}

/**
 * A three-candle imbalance. Bullish: the third candle's low is above the first candle's high, leaving
 * the range between them untraded. Bearish is the mirror. Drawn from the middle candle; known at the
 * close of the third.
 *
 * open     price has not traded back into the gap
 * partial  price has traded into it (`filled` says how far, 0–1)
 * filled   price has traded all the way through it
 */
export type FairValueGap = {
  id: string
  direction: `bullish` | `bearish`
  symbol: string
  provider: string
  timeframe: Timeframe
  high: number
  low: number
  /** Open time of the middle candle. */
  originTime: number
  confirmedAt: number
  sizeATR: number
  status: `open` | `partial` | `filled`
  statusChangedAt: number
  /** Deepest fill so far, from 0 (untouched) to 1 (fully filled). */
  filled: number
  engineVersion: string
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
  structure: StructureEvent[]
  zones: SupplyDemandZone[]
  orderBlocks: OrderBlock[]
  fvgs: FairValueGap[]
}
