// The only place the Power Rankings pages touch the rest of the app. `configureRankings` once at start-up (optional:
// every setting has a default).
import type { ComponentType, ReactNode } from "react";

export interface RankingsDeps {
  /** Where the API is mounted. Default "/api/rankings". */
  apiBase?: string;
  /** The app's router link (no full reload). Defaults to <a>. */
  Link?: ComponentType<{ to: string; className?: string; children: ReactNode; "aria-label"?: string }>;
  /** Hook the app uses for <title>/meta. Optional. */
  usePageMeta?: (meta: { title: string; description: string }) => void;
  /** Address of the main signals page, for the Signals | Power Rankings tabs. Default "/signals". */
  signalsHref?: string;
}

let deps: RankingsDeps = {};
export const configureRankings = (next: RankingsDeps) => {
  deps = next;
};
export const rankingsDeps = () => deps;
