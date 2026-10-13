import { IllegalTransitionError, type OnboardingAction, type OnboardingStatus } from "./types";

/**
 * The linear "happy path" order. NEXT/BACK move one step along this list.
 * Branching outcomes (APPROVED / REJECTED / COMPLETED) are reached only via
 * explicit admin or submission actions, never by generic NEXT/BACK, so a user
 * can never click their way into a state that implies admin sign-off.
 */
const FORWARD_ORDER: readonly OnboardingStatus[] = [
  "STARTED",
  "AWAITING_BROKER_SIGNUP",
  "ACCOUNT_CREATED",
  "KYC_PENDING",
  "KYC_COMPLETE",
  "DEPOSIT_PENDING",
  "DEPOSIT_SUBMITTED",
];

function forwardIndex(status: OnboardingStatus): number {
  return FORWARD_ORDER.indexOf(status);
}

export function canGoNext(status: OnboardingStatus): boolean {
  const i = forwardIndex(status);
  return i >= 0 && i < FORWARD_ORDER.length - 1 ? true : status === "APPROVED";
}

export function canGoBack(status: OnboardingStatus): boolean {
  // REJECTED isn't part of the forward path, but it has its own one-step
  // "back" into DEPOSIT_PENDING so the user can resubmit a screenshot.
  return forwardIndex(status) > 0 || status === "REJECTED";
}

export function canRestart(status: OnboardingStatus): boolean {
  return status !== "COMPLETED";
}

/**
 * Pure state transition function. Throws IllegalTransitionError for anything
 * that doesn't make sense (e.g. trying to submit deposit proof while still on KYC).
 * Callers (API routes, Telegram adapter, etc.) catch this and turn it into a
 * friendly "that doesn't look right, try /restart" message rather than a crash.
 */
export function applyTransition(current: OnboardingStatus, action: OnboardingAction): OnboardingStatus {
  switch (action.type) {
    case "NEXT": {
      const i = forwardIndex(current);
      if (i >= 0 && i < FORWARD_ORDER.length - 1) return FORWARD_ORDER[i + 1];
      if (current === "APPROVED") return "COMPLETED";
      throw new IllegalTransitionError(current, action.type);
    }

    case "BACK": {
      if (current === "REJECTED") return "DEPOSIT_PENDING";
      const i = forwardIndex(current);
      if (i > 0) return FORWARD_ORDER[i - 1];
      throw new IllegalTransitionError(current, action.type);
    }

    case "RESTART": {
      if (!canRestart(current)) throw new IllegalTransitionError(current, action.type);
      return "STARTED";
    }

    case "SELECT_BROKER": {
      if (current !== "AWAITING_BROKER_SIGNUP" && current !== "STARTED") {
        throw new IllegalTransitionError(current, action.type);
      }
      return current; // choosing a broker doesn't move the step on its own
    }

    case "SUBMIT_DEPOSIT_PROOF": {
      if (current !== "DEPOSIT_PENDING" && current !== "REJECTED") {
        throw new IllegalTransitionError(current, action.type);
      }
      return "DEPOSIT_SUBMITTED";
    }

    case "ADMIN_APPROVE": {
      if (current !== "DEPOSIT_SUBMITTED") throw new IllegalTransitionError(current, action.type);
      return "APPROVED";
    }

    case "ADMIN_REJECT": {
      if (current !== "DEPOSIT_SUBMITTED") throw new IllegalTransitionError(current, action.type);
      return "REJECTED";
    }

    default:
      return current;
  }
}
