import type { BrokerInfo, OnboardingStatus } from "./types";

/**
 * All user-facing onboarding copy lives in this one file.
 * This is the single place to edit wording — nothing else in the codebase
 * should have onboarding message strings hardcoded into it.
 */

export interface StepContext {
  broker: BrokerInfo | null;
  rejectionReason: string | null;
}

export interface StepGuideImage {
  /** Path under /public, e.g. "/onboarding-guides/kyc-level2.jpg" */
  src: string;
  alt: string;
}

export interface StepContent {
  heading: string;
  body: (ctx: StepContext) => string;
  primaryLabel: string;
  showUploadField: boolean;
  /** Optional walkthrough screenshots shown under the body text, in order. */
  images?: StepGuideImage[];
}

export const STEP_CONTENT: Record<OnboardingStatus, StepContent> = {
  STARTED: {
    heading: "Welcome to PACT",
    body: () =>
      "This short setup will guide you through getting access to PACT's trading signals, one step at a time. " +
      "You can leave at any point and pick up right where you left off.",
    primaryLabel: "Get started",
    showUploadField: false,
  },
  AWAITING_BROKER_SIGNUP: {
    heading: "Create your broker account",
    body: (ctx) =>
      ctx.broker
        ? `Tap the button below to open ${ctx.broker.name}'s signup page in a new tab. This is what account setup looks like — create your account, then come back here and press Next.`
        : "A broker link will appear here once one is configured.",
    primaryLabel: "I've created my account",
    showUploadField: false,
    images: [{ src: "/onboarding-guides/account-setup-form.jpg", alt: "Broker account setup form" }],
  },
  ACCOUNT_CREATED: {
    heading: "Confirm your account",
    body: () => "Once you've finished creating your broker account, press Next to continue to identity verification (KYC).",
    primaryLabel: "Next",
    showUploadField: false,
  },
  KYC_PENDING: {
    heading: "Verify your identity (KYC)",
    body: () =>
      "Complete the identity verification (KYC) steps inside your broker account — this usually means uploading an ID " +
      "document and confirming your address. Follow the pictures below if you're not sure where to go. Once it's done " +
      "(or submitted for review), press Next.",
    primaryLabel: "KYC done",
    showUploadField: false,
    images: [
      { src: "/onboarding-guides/kyc-step1-navigate.jpg", alt: "Step 1: open your profile" },
      { src: "/onboarding-guides/kyc-step2-level2.jpg", alt: "Step 2: start Level 2 identity verification" },
      { src: "/onboarding-guides/kyc-step3-upload-passport.jpg", alt: "Step 3: upload your passport" },
      { src: "/onboarding-guides/kyc-step4-level3.jpg", alt: "Step 4: start Level 3 residency verification" },
    ],
  },
  KYC_COMPLETE: {
    heading: "Make your first deposit",
    body: (ctx) =>
      ctx.broker
        ? `Deposit at least ${ctx.broker.minDepositCurrency}${ctx.broker.minDepositAmount} into your new broker account. Once the deposit has gone through, press Next.`
        : "Deposit details will appear here once a broker is configured.",
    primaryLabel: "I've made my deposit",
    showUploadField: false,
  },
  DEPOSIT_PENDING: {
    heading: "Upload proof of your deposit",
    body: (ctx) =>
      ctx.rejectionReason
        ? `Your last submission needs another look: ${ctx.rejectionReason}\n\nPlease upload a new screenshot showing your deposit.`
        : "Upload a screenshot showing your completed deposit. One of our team will manually check it — this usually doesn't take long.",
    primaryLabel: "Submit for review",
    showUploadField: true,
  },
  DEPOSIT_SUBMITTED: {
    heading: "Your deposit is being reviewed",
    body: () =>
      "Thanks — we've received your screenshot. A member of our team will check it shortly and you'll get a message here as soon as it's approved.",
    primaryLabel: "Waiting for review",
    showUploadField: false,
  },
  APPROVED: {
    heading: "You're approved!",
    body: () => "Your deposit has been verified. Press Next to get your signal group access and final instructions.",
    primaryLabel: "Next",
    showUploadField: false,
  },
  REJECTED: {
    heading: "One more thing needed",
    body: (ctx) => ctx.rejectionReason ?? "We couldn't verify your last submission. Please try again.",
    primaryLabel: "Resubmit",
    showUploadField: false,
  },
  COMPLETED: {
    heading: "All done",
    body: () => "You're fully onboarded. Welcome to PACT.",
    primaryLabel: "Finish",
    showUploadField: false,
  },
};
