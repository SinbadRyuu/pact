// The only place the Live calls page touches the rest of the app. Call `configureLiveCalls` once at start-up, in the
// investment entry file, before the router renders. The README shows the exact lines.

/** Shared with the overview's "Next live call" card, so invalidating this prefix refreshes both. */
export const LIVE_CALLS_KEY = ["investment", "calls"] as const;

export interface ApiError {
  message: string;
  /** Field-level messages from the server, keyed by field name. */
  fields?: Record<string, string>;
}

export interface LiveCallsDeps {
  /** The app's API client `get`: prefixes /api/v1, sends cookies, throws ApiError on failure. */
  get: <T>(path: string, opts?: { signal?: AbortSignal; query?: Record<string, string | number | undefined> }) => Promise<T>;
  /** The app's API client `post`: adds the CSRF header and the idempotency key. */
  post: <T>(path: string, body: unknown, opts?: { idempotencyKey?: string }) => Promise<T>;
  /** A React hook: true when the signed-in person can schedule calls (`admin.investment.manage`). */
  useCanManage: () => boolean;
  /** Optional React hook returning Date.now(), ticking each second. The app's shared clock keeps every page in step. */
  useNow?: () => number;
  /** Optional: sets the browser tab title the way other pages do. */
  usePageTitle?: (title: string) => void;
  /** Optional: shows a success toast. */
  notify?: (message: string) => void;
}

let deps: LiveCallsDeps | null = null;

export function configureLiveCalls(next: LiveCallsDeps) {
  deps = next;
}

export function liveCallsDeps(): LiveCallsDeps {
  if (!deps) throw new Error("configureLiveCalls() has not been called. See investment-live-calls/README.md.");
  return deps;
}
