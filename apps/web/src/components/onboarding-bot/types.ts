import type { SerializedOnboardingState } from "@/lib/serializeOnboardingState";

export type OnboardingState = SerializedOnboardingState;

export interface OnboardingBotTheme {
  accentColor: string;
  backgroundColor: string;
  textColor: string;
  borderRadius: string;
  fontFamily: string;
}

export const DEFAULT_THEME: OnboardingBotTheme = {
  accentColor: "#6d28d9",
  backgroundColor: "#ffffff",
  textColor: "#18181b",
  borderRadius: "12px",
  fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
};

export interface OnboardingBotProps {
  /**
   * Base URL the component calls for its API (e.g. "" for same-origin,
   * or "https://onboarding.pact.example" once embedded on a different
   * domain than the API). Defaults to same-origin relative paths.
   */
  apiBaseUrl?: string;
  /** Partial theme override — anything not set falls back to DEFAULT_THEME. */
  theme?: Partial<OnboardingBotTheme>;
  /** Extra class applied to the root element, for the host page to position/size it. */
  className?: string;
}
