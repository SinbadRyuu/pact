// The only place the Indicators pages touch the rest of the app. Call `configureIndicators` once at start-up.
import type { ComponentType, ReactNode } from "react";

export interface IndicatorsDeps {
  /** Access token for `Authorization: Bearer …` (Supabase: session.access_token). Leave out for cookie auth. */
  getAccessToken?: () => Promise<string | null>;
  /** Where the API is mounted. Default "/api/indicators". */
  apiBase?: string;
  /** Sign-in page with a return address. Default /sign-in?next=… */
  signInHref?: (next: string) => string;
  /** Where "Subscribe to unlock" goes when downloads need a subscription. Default /automation#instant-impact */
  subscribeHref?: string;
  /** The app's router link (no full reload). Defaults to <a>. */
  Link?: ComponentType<{ to: string; className?: string; children: ReactNode; "aria-label"?: string }>;
  /** Hook the app uses for <title>/meta. Optional; falls back to setting them directly. */
  usePageMeta?: (meta: { title: string; description: string; image?: string | null }) => void;
}

let deps: IndicatorsDeps = {};

export function configureIndicators(next: IndicatorsDeps) {
  deps = next;
}

export const indicatorsDeps = () => deps;
