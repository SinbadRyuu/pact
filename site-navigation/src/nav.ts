// The three new main-nav entries. Add them to the site's existing nav list (README shows where); the shape is
// deliberately plain so it fits whatever the nav component already maps over.

export interface NavItem {
  label: string;
  href: string;
  /** Short label for a phone bottom bar or tight spaces. */
  shortLabel: string;
  /** Line icon (24×24 viewBox path) in the same style as the site's other nav icons. */
  icon: string;
  /** Paths that should highlight this item. */
  match: RegExp;
  /** Shown as a small "New" badge until this date (ISO), to draw TikTok/LinkedIn visitors to the new pages. */
  newUntil?: string;
}

export const NEW_NAV_ITEMS: NavItem[] = [
  {
    label: "Automation",
    shortLabel: "Automate",
    href: "/automation",
    // Lightning bolt
    icon: "M13 2 4 14h7l-1 8 9-12h-7l1-8Z",
    match: /^\/automation(\/|$)/,
    newUntil: "2027-01-31",
  },
  {
    label: "Indicators",
    shortLabel: "Indicators",
    href: "/indicators",
    // Candles with a trend line
    icon: "M6 4v16M6 8h-2v6h4V8H6Zm6-4v16m0-12h-2v8h4V8h-2Zm6-2v16m0-12h-2v4h4v-4h-2Z",
    match: /^\/(indicators|charts?|app\/charts?)(\/|$)/,
  },
  {
    label: "Power Rankings",
    shortLabel: "Rankings",
    href: "/signals/rankings",
    // Podium
    icon: "M9 10h6v10H9zM3 14h6v6H3zm12-2h6v8h-6zM12 3l1.2 2.4 2.6.4-1.9 1.8.5 2.6L12 9l-2.4 1.2.5-2.6-1.9-1.8 2.6-.4Z",
    match: /^\/signals\/(rankings|providers)(\/|$)/,
    newUntil: "2027-01-31",
  },
];

/** True when `pathname` belongs to the nav item (so the item shows as current). */
export const isActive = (item: NavItem, pathname: string) => item.match.test(pathname);

/** True while the "New" badge should show. */
export const isNew = (item: NavItem, now = new Date()) => Boolean(item.newUntil && now < new Date(`${item.newUntil}T23:59:59Z`));

/**
 * Where to put them. Suggested order for the main nav: …Signals, Power Rankings, Automation, Indicators, Education…
 * i.e. Power Rankings right after Signals (it's the same topic), then the two product pages.
 */
export function withNewItems<T extends { href: string }>(existing: T[], toItem: (n: NavItem) => T, after = "/signals"): T[] {
  const out = existing.filter((e) => !NEW_NAV_ITEMS.some((n) => n.href === e.href) && !/^\/(chart|charts)$/.test(e.href));
  const at = out.findIndex((e) => e.href === after);
  const items = NEW_NAV_ITEMS.map(toItem);
  const ordered = [items[2], items[0], items[1]]; // Power Rankings, Automation, Indicators
  if (at === -1) return [...out, ...ordered];
  return [...out.slice(0, at + 1), ...ordered, ...out.slice(at + 1)];
}
