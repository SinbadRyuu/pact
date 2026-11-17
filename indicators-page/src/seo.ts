// SEO titles and meta descriptions for the Indicators pages.
import type { IndicatorSummary } from "./api";

const PLATFORM = { tradingview: "TradingView", mt4: "MT4", mt5: "MT5" } as const;

export const INDICATORS_SEO = {
  list: {
    title: "Trading Indicators for TradingView, MT4 & MT5 | VT Impact",
    description:
      "Download VT Impact's trading indicators for MT4 and MT5, or add them to TradingView in a tap. Market structure, sessions, volatility and more.",
  },
  detail: (i: Pick<IndicatorSummary, "name" | "platform" | "description">) => ({
    title: `${i.name} for ${PLATFORM[i.platform]} | VT Impact Indicators`,
    // Meta descriptions get cut at ~155 characters.
    description: i.description.length > 155 ? `${i.description.slice(0, 152).trimEnd()}…` : i.description,
  }),
};
