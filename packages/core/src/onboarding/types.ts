/**
 * Platform-agnostic onboarding domain types.
 * No Telegram, no React, no Next.js here — adapters depend on this, never the other way round.
 */

export type OnboardingStatus =
  | "STARTED"
  | "AWAITING_BROKER_SIGNUP"
  | "ACCOUNT_CREATED"
  | "KYC_PENDING"
  | "KYC_COMPLETE"
  | "DEPOSIT_PENDING"
  | "DEPOSIT_SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "COMPLETED";

export const ONBOARDING_STATUSES: readonly OnboardingStatus[] = [
  "STARTED",
  "AWAITING_BROKER_SIGNUP",
  "ACCOUNT_CREATED",
  "KYC_PENDING",
  "KYC_COMPLETE",
  "DEPOSIT_PENDING",
  "DEPOSIT_SUBMITTED",
  "APPROVED",
  "REJECTED",
  "COMPLETED",
];

/** The statuses an admin review queue should show. */
export const REVIEW_QUEUE_STATUSES: readonly OnboardingStatus[] = ["DEPOSIT_SUBMITTED"];

export interface BrokerInfo {
  id: string;
  name: string;
  signupUrl: string;
  minDepositAmount: number;
  minDepositCurrency: string;
  isActive: boolean;
}

export interface OnboardingSessionState {
  sessionId: string;
  status: OnboardingStatus;
  brokerId: string | null;
  depositAmountClaimed: number | null;
  depositScreenshotRef: string | null;
  rejectionReason: string | null;
  referralCode: string | null;
  createdAt: string;
  updatedAt: string;
}

export type OnboardingAction =
  | { type: "NEXT" }
  | { type: "BACK" }
  | { type: "RESTART" }
  | { type: "SELECT_BROKER"; brokerId: string }
  | { type: "SUBMIT_DEPOSIT_PROOF"; depositAmountClaimed: number; screenshotRef: string }
  | { type: "ADMIN_APPROVE" }
  | { type: "ADMIN_REJECT"; reason: string };

export class IllegalTransitionError extends Error {
  constructor(public readonly status: OnboardingStatus, public readonly action: OnboardingAction["type"]) {
    super(`Action "${action}" is not allowed from status "${status}"`);
    this.name = "IllegalTransitionError";
  }
}
