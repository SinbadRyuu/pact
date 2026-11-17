// In-browser stand-in for the three APIs. Indicators and Power Rankings run their REAL server code (routers, stats,
// periods) over sample data; Automation answers by persona, since Stripe can't run in a browser.
import { createIndicatorsApi } from "../../indicators-page/server/router";
import { createMemoryIndicatorStore } from "../../indicators-page/server/store";
import type { IndicatorRecord } from "../../indicators-page/server/types";
import { createRankingsApi, readRankingsConfig } from "../../power-rankings/server/router";
import { createMemoryRankingsStore } from "../../power-rankings/server/store";
import { PREVIEW_PROVIDERS, previewTrades } from "../../power-rankings/preview/data";
import { persona, previewUrl } from "./nav";

const base = { longDescription: null, screenshots: [], installSteps: [], changelog: [], fileUrl: null, tradingviewUrl: null, sortOrder: 0, image: null };
const INDICATORS: IndicatorRecord[] = [
  {
    ...base,
    id: "1",
    slug: "vt-structure",
    name: "VT Structure",
    description: "Market structure with BOS/CHoCH, swing labels, a Fibonacci zone and rule-based entry, SL and TP levels.",
    longDescription:
      "VT Structure maps market structure for you. It labels every confirmed swing as HH, LH, HL or LL, draws BOS lines when price breaks with the trend and CHoCH lines when it breaks against it, and marks reversals with a triangle.\n\nIt adds 21 and 50 EMAs, a Fibonacci retracement of the current leg with the 0.618 to 0.786 zone shaded, and buy and sell signals with entry, stop loss and three targets.\n\nSignals are rules applied to past candles, not forecasts, and nothing here is financial advice.",
    platform: "tradingview",
    version: "1.0",
    tradingviewUrl: "https://www.tradingview.com/",
    accessLevel: "members",
    downloadCount: 412,
    updatedAt: "2026-10-13T00:00:00.000Z",
    changelog: [{ version: "1.0", date: "2026-10-13", changes: ["First release: swings, BOS/CHoCH, EMAs, Fibonacci zone, signals and dashboard"] }],
  },
  {
    ...base,
    id: "2",
    slug: "session-boxes",
    name: "Session Boxes",
    description: "Asia, London and New York session ranges drawn on your chart, with the high and low of each.",
    platform: "mt5",
    version: "2.3",
    fileUrl: "https://example.com/session-boxes.ex5",
    accessLevel: "free",
    downloadCount: 1284,
    updatedAt: "2026-11-02T00:00:00.000Z",
  },
  {
    ...base,
    id: "3",
    slug: "liquidity-sweeps",
    name: "Liquidity Sweeps",
    description: "Flags sweeps of the previous day's high and low, with alerts when price takes them.",
    platform: "tradingview",
    version: "1.2",
    tradingviewUrl: "https://www.tradingview.com/",
    accessLevel: "free",
    downloadCount: 2311,
    updatedAt: "2026-11-12T00:00:00.000Z",
  },
  {
    ...base,
    id: "4",
    slug: "gold-volatility-bands",
    name: "Gold Volatility Bands",
    description: "ATR bands tuned for XAUUSD, so you can see when gold is stretched.",
    platform: "mt4",
    version: "1.4",
    fileUrl: "storage:indicators/gold-volatility-bands-1.4.ex4",
    accessLevel: "members",
    downloadCount: 389,
    updatedAt: "2026-09-20T00:00:00.000Z",
  },
];

const indicatorsApi = createIndicatorsApi({
  store: createMemoryIndicatorStore(INDICATORS),
  getUser: async () => (persona() === "visitor" ? null : { id: "preview-user" }),
  // In the preview a "download" just comes back to the page with a note, instead of leaving it.
  signFile: async () => previewUrl("/indicators", { downloaded: "1" }),
});

const rankingsApi = createRankingsApi({
  store: createMemoryRankingsStore(PREVIEW_PROVIDERS, previewTrades()),
  config: readRankingsConfig({}),
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

function automationApi(req: Request): Response {
  const path = new URL(req.url).pathname.replace("/api/automation", "");
  const who = persona();
  const end = new Date(Date.now() + 21 * 86_400_000).toISOString();
  const sub =
    who === "subscribed"
      ? { status: "active", currentPeriodEnd: end, cancelAtPeriodEnd: false }
      : who === "payment_failed"
        ? { status: "past_due", currentPeriodEnd: end, cancelAtPeriodEnd: false }
        : who === "cancelled"
          ? { status: "cancelled", currentPeriodEnd: end, cancelAtPeriodEnd: false }
          : null;
  const hasAccess = who === "subscribed";
  if (path === "/state") {
    return json({
      signedIn: who !== "visitor",
      priceLabel: "$9.99/month",
      subscription: sub,
      hasAccess,
      canManage: Boolean(sub),
      telegramLink: hasAccess ? "https://t.me/" : null,
      links: {
        vtMarketsSignup: "https://example.com/vt-markets-signup",
        sniperBotCopy: "https://example.com/sniper-bot",
        sniperBotApp: null,
        vtMarketsAndroidPackage: null,
        crucialMarkets: "https://example.com/crucial-markets",
      },
    });
  }
  if (path === "/signals") {
    if (!hasAccess) return json({ locked: true, signals: [] });
    const now = Date.now();
    return json({
      locked: false,
      telegramLink: "https://t.me/",
      signals: [
        { id: "a", pair: "XAUUSD", direction: "SELL", entryFrom: 4142.5, entryTo: 4145, takeProfits: [4136, 4129, 4118], stopLoss: 4151, status: "active", targetsHit: 1, notes: "Rejection at the London high. Partial at TP1, stop to entry.", createdAt: new Date(now - 6 * 60_000).toISOString() },
        { id: "b", pair: "XAUUSD", direction: "BUY", entryFrom: 4108, entryTo: null, takeProfits: [4115, 4122, 4134], stopLoss: 4101, status: "take_profit", targetsHit: 3, notes: null, createdAt: new Date(now - 4 * 3600_000).toISOString() },
        { id: "c", pair: "GBPJPY", direction: "SELL", entryFrom: 198.42, entryTo: null, takeProfits: [197.9, 197.4], stopLoss: 198.9, status: "stop_loss", targetsHit: 0, notes: null, createdAt: new Date(now - 27 * 3600_000).toISOString() },
      ],
    });
  }
  if (path === "/checkout") {
    if (who === "visitor") return json({ error: "sign_in_required", next: "/automation/subscribe" }, 401);
    // Stripe Checkout would open here; the preview jumps straight to the success page as a subscriber.
    return json({ url: previewUrl("/automation/success", { as: "subscribed", session_id: "cs_test_preview" }) });
  }
  if (path === "/portal") return json({ url: previewUrl("/stripe-portal") });
  if (path === "/checkout/confirm") return json({ ok: true, hasAccess, status: sub?.status ?? null, telegramLink: hasAccess ? "https://t.me/" : null });
  return json({ error: "not_found" }, 404);
}

/** Routes /api/* to the stand-ins; everything else goes to the real network. */
export async function mockFetch(path: string, init?: RequestInit): Promise<Response | null> {
  if (!path.startsWith("/api/")) return null;
  const req = new Request(`https://app.local${path}`, init);
  if (path.startsWith("/api/indicators")) return (await indicatorsApi(req))!;
  if (path.startsWith("/api/rankings")) return (await rankingsApi(req))!;
  if (path.startsWith("/api/automation")) return automationApi(req);
  return json({ error: "not_found" }, 404);
}

export function installMockFetch() {
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = raw.startsWith("/") ? raw : raw.replace(/^[a-z]+:\/\/[^/]+/i, "");
    return (await mockFetch(path, init)) ?? real(input, init);
  };
}
