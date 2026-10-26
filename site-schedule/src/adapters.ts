// The only place the schedule page's shell touches the rest of the main app. `setup.example.ts` shows the lines.
import type { ComponentType } from "react";

/** The session as the app's session hook returns it (the same shape the landing page and investment app read). */
export interface SessionResult {
  isPending: boolean;
  data?: { state: "signed_in" | "signed_out" | "mfa_required" | string } | null;
}

export interface ScheduleShellDeps {
  /** The app's session hook. */
  useSession: () => SessionResult;
  /** The IMPACT logo the landing page uses (it takes `inverse` for dark backgrounds). */
  Logo: ComponentType<{ inverse?: boolean }>;
  /** The risk line every page footer shows. */
  riskLine?: string;
}

let deps: ScheduleShellDeps | null = null;

export function configureScheduleShell(next: ScheduleShellDeps) {
  deps = next;
}

export function scheduleShellDeps(): ScheduleShellDeps {
  if (!deps) throw new Error("configureScheduleShell() has not been called. See site-schedule/README.md.");
  return deps;
}
