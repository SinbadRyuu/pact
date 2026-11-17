// Two new cards for the Home page's existing "GO TO" section (Signals, Trader Signals, Chart, Indicators, News,
// Dashboard, Trade Journal, Phone Alerts, Everything Else). They're plain entries in the same shape as the existing
// cards, so they render with the existing card component and look exactly like the others.
// Indicators already has a card there; it now opens the page with the new VT IMPACT INDICATORS panel.

export interface GoToCard {
  title: string;
  description: string;
  href: string;
  /** The icon's name in lucide (the set the other GO TO icons come from). */
  lucide: string;
  /** The same icon as SVG path data (24×24, stroke), for a card component that takes raw SVG. */
  iconPaths: string[];
}

export const GO_TO_ADDITIONS: GoToCard[] = [
  {
    title: "Automation",
    description: "Instant Impact signals and The Sniper Bot",
    href: "/automation",
    lucide: "bot",
    iconPaths: [
      "M12 8V4H8",
      "M6 8h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2Z",
      "M2 14h2",
      "M20 14h2",
      "M15 13v2",
      "M9 13v2",
    ],
  },
  {
    title: "Power Rankings",
    description: "Every signal provider ranked by real trades",
    href: "/signals/rankings",
    lucide: "trophy",
    iconPaths: [
      "M6 9H4.5a2.5 2.5 0 0 1 0-5H6",
      "M18 9h1.5a2.5 2.5 0 0 0 0-5H18",
      "M4 22h16",
      "M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22",
      "M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22",
      "M18 2H6v7a6 6 0 0 0 12 0V2Z",
    ],
  },
];

/**
 * Optional wording updates for two existing cards, now that Automation has its own card and Indicators has downloads:
 *   Everything Else: "Automation, practice, settings and more"  →  "Practice, settings and more"
 *   Indicators:      "Built-in indicators, your settings and scripts"  →  "Our indicators, built-ins, your settings and scripts"
 */
export const GO_TO_COPY_UPDATES: Record<string, string> = {
  "Everything Else": "Practice, settings and more",
  Indicators: "Our indicators, built-ins, your settings and scripts",
};

/**
 * Adds the two cards to the existing list, just before "Everything Else" (which stays last), skipping any that are
 * already there. With five cards per row on desktop that fills row two:
 *   Signals · Trader Signals · Chart · Indicators · News
 *   Dashboard · Trade Journal · Phone Alerts · Automation · Power Rankings
 *   Everything Else
 */
export function withGoToCards<T extends { href?: string; to?: string; title?: string; label?: string }>(
  existing: T[],
  toCard: (c: GoToCard) => T,
  opts: { updateCopy?: (card: T, description: string) => T } = {},
): T[] {
  const key = (c: { href?: string; to?: string }) => c.href ?? c.to ?? "";
  const name = (c: { title?: string; label?: string }) => c.title ?? c.label ?? "";
  const add = GO_TO_ADDITIONS.filter((n) => !existing.some((e) => key(e) === n.href || name(e) === n.title)).map(toCard);
  let list = existing;
  if (opts.updateCopy) list = list.map((e) => (GO_TO_COPY_UPDATES[name(e)] ? opts.updateCopy!(e, GO_TO_COPY_UPDATES[name(e)]) : e));
  const at = list.findIndex((e) => name(e) === "Everything Else");
  return at === -1 ? [...list, ...add] : [...list.slice(0, at), ...add, ...list.slice(at)];
}
