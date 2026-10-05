"use client";

import { useState } from "react";
import styles from "./OnboardingBot.module.css";
import { useOnboardingState } from "./useOnboardingState";
import { DEFAULT_THEME, type OnboardingBotProps } from "./types";

/** Display-only ordering for the progress dots. Not used for any business logic. */
const DISPLAY_STEPS = [
  "STARTED",
  "AWAITING_BROKER_SIGNUP",
  "ACCOUNT_CREATED",
  "KYC_PENDING",
  "KYC_COMPLETE",
  "DEPOSIT_PENDING",
  "DEPOSIT_SUBMITTED",
] as const;

const HELP_TEXT =
  "Stuck? Each step tells you exactly what to do next. If something looks wrong, press Restart to begin again, " +
  "or contact our team and we'll help you out directly.";

/**
 * Self-contained onboarding widget. Drop it anywhere in a page:
 *
 *   <OnboardingBot />
 *
 * It fetches/owns its own state via the onboarding API and renders one step
 * at a time. See README.md in this folder for integration details.
 */
export function OnboardingBot({ apiBaseUrl = "", theme, className }: OnboardingBotProps) {
  const { state, loading, actionPending, error, next, back, restart, submitDeposit, reload } =
    useOnboardingState(apiBaseUrl);
  const [showHelp, setShowHelp] = useState(false);
  const [amount, setAmount] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const mergedTheme = { ...DEFAULT_THEME, ...theme };
  const cssVars = {
    "--pact-accent": mergedTheme.accentColor,
    "--pact-bg": mergedTheme.backgroundColor,
    "--pact-text": mergedTheme.textColor,
    "--pact-radius": mergedTheme.borderRadius,
    "--pact-font": mergedTheme.fontFamily,
  } as React.CSSProperties;

  if (loading && !state) {
    return (
      <div className={[styles.root, className].filter(Boolean).join(" ")} style={cssVars}>
        <p className={styles.loadingState}>Loading…</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className={[styles.root, className].filter(Boolean).join(" ")} style={cssVars}>
        <p className={styles.errorBanner}>{error ?? "Couldn't load onboarding."}</p>
        <button type="button" className={styles.secondaryButton} onClick={reload}>
          Try again
        </button>
      </div>
    );
  }

  const stepIndex = DISPLAY_STEPS.indexOf(state.status as (typeof DISPLAY_STEPS)[number]);

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedAmount = Number(amount);
    if (!file || !Number.isFinite(parsedAmount) || parsedAmount <= 0) return;
    await submitDeposit(parsedAmount, file);
    setAmount("");
    setFile(null);
  }

  return (
    <div className={[styles.root, className].filter(Boolean).join(" ")} style={cssVars}>
      <div className={styles.topBar}>
        {stepIndex >= 0 ? (
          <div className={styles.progressDots} aria-hidden="true">
            {DISPLAY_STEPS.map((s, i) => (
              <span key={s} className={i <= stepIndex ? `${styles.dot} ${styles.dotActive}` : styles.dot} />
            ))}
          </div>
        ) : (
          <span />
        )}
        <button type="button" className={styles.helpButton} onClick={() => setShowHelp((v) => !v)}>
          Help
        </button>
      </div>

      {showHelp && <div className={styles.helpPanel}>{HELP_TEXT}</div>}

      {error && <div className={styles.errorBanner}>{error}</div>}

      <h2 className={styles.heading}>{state.heading}</h2>
      <p className={styles.body}>{state.body}</p>

      {state.status === "AWAITING_BROKER_SIGNUP" && state.broker && (
        <a
          href={state.broker.signupUrl}
          target="_blank"
          rel="noopener noreferrer"
          className={styles.linkButton}
        >
          Open {state.broker.name} signup page
        </a>
      )}

      {state.showUploadField ? (
        <form onSubmit={handleUploadSubmit}>
          <div className={styles.uploadField}>
            <label htmlFor="pact-deposit-amount">Amount deposited</label>
            <input
              id="pact-deposit-amount"
              type="number"
              min="0"
              step="0.01"
              placeholder={state.broker ? `e.g. ${state.broker.minDepositAmount}` : "e.g. 500"}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
            <label htmlFor="pact-deposit-screenshot">Deposit screenshot</label>
            <input
              id="pact-deposit-screenshot"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/heic"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
          </div>
          <div className={styles.actions}>
            <button type="submit" className={styles.primaryButton} disabled={actionPending || !file}>
              {actionPending ? "Submitting…" : state.primaryLabel}
            </button>
            {state.canGoBack && (
              <button type="button" className={styles.secondaryButton} onClick={back} disabled={actionPending}>
                Back
              </button>
            )}
          </div>
        </form>
      ) : state.status === "REJECTED" ? (
        <div className={styles.actions}>
          <button type="button" className={styles.primaryButton} onClick={back} disabled={actionPending}>
            {actionPending ? "Please wait…" : state.primaryLabel}
          </button>
        </div>
      ) : (
        <div className={styles.actions}>
          {state.canGoNext && (
            <button type="button" className={styles.primaryButton} onClick={next} disabled={actionPending}>
              {actionPending ? "Please wait…" : state.primaryLabel}
            </button>
          )}
          {state.canGoBack && (
            <button type="button" className={styles.secondaryButton} onClick={back} disabled={actionPending}>
              Back
            </button>
          )}
        </div>
      )}

      {state.canRestart && (
        <div style={{ marginTop: 12 }}>
          <button
            type="button"
            className={styles.restartButton}
            onClick={() => {
              if (confirm("Restart your onboarding from the beginning? This clears your current progress.")) {
                restart();
              }
            }}
            disabled={actionPending}
          >
            Restart
          </button>
        </div>
      )}
    </div>
  );
}
