// The only place the Automation page touches the rest of the vtimpact.com app.
// Call `configureAutomation` once at start-up, before the routes render (README, step 4).
import type { ComponentType, ReactNode } from "react";

/** The session as the app's session hook returns it (same shape the schedule and investment pages read). */
export interface SessionResult {
  isPending: boolean;
  data?: { state: "signed_in" | "signed_out" | "mfa_required" | string } | null;
}

export interface AutomationDeps {
  /** The app's session hook. */
  useSession: () => SessionResult;
  /**
   * Returns the signed-in user's access token, sent as `Authorization: Bearer …` to the API.
   * Supabase: `async () => (await supabase.auth.getSession()).data.session?.access_token ?? null`.
   * Leave out if the API authenticates by cookie.
   */
  getAccessToken?: () => Promise<string | null>;
  /** Where the API is mounted. Default "/api/automation". */
  apiBase?: string;
  /** Sign-in and sign-up pages, with where to come back to. Defaults: /sign-in?next=… and /sign-up?next=… */
  signInHref?: (next: string) => string;
  signUpHref?: (next: string) => string;
  /** The app's router link, for in-app navigation without a full reload. Defaults to <a>. */
  Link?: ComponentType<{ to: string; className?: string; children: ReactNode }>;
  /** Called with the page's SEO title and description (e.g. the app's usePageTitle / Helmet). Optional. */
  usePageMeta?: (meta: { title: string; description: string }) => void;
}

let deps: AutomationDeps | null = null;

export function configureAutomation(next: AutomationDeps) {
  deps = next;
}

export function automationDeps(): AutomationDeps {
  if (!deps) throw new Error("configureAutomation() has not been called. See automation/README.md.");
  return deps;
}
