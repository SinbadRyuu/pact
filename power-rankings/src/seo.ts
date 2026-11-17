// SEO titles and meta descriptions for Power Rankings.
export const RANKINGS_SEO = {
  rankings: {
    title: "Signal Provider Power Rankings | VT Impact",
    description:
      "Every VT Impact signal provider ranked by real, closed trades: net pips, win rate, profit factor and drawdown, by week, month or year.",
  },
  provider: (name: string) => ({
    title: `${name}: Signal Track Record & Stats | VT Impact`,
    description: `${name}'s full signal track record on VT Impact: net pips, win rate, drawdown, monthly results and every trade, calculated from closed trades.`,
  }),
};
