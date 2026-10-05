import { canGoBack, canGoNext, canRestart, STEP_CONTENT, type BrokerInfo } from "@pact/core";
import type { Broker, OnboardingSession } from "@prisma/client";

export type SessionWithBroker = OnboardingSession & { broker: Broker | null };

function toBrokerInfo(broker: Broker | null): BrokerInfo | null {
  if (!broker) return null;
  return {
    id: broker.id,
    name: broker.name,
    signupUrl: broker.signupUrl,
    minDepositAmount: broker.minDepositAmount,
    minDepositCurrency: broker.minDepositCurrency,
    isActive: broker.isActive,
  };
}

/**
 * Turns a DB row into exactly what the widget needs: current step copy,
 * which buttons are allowed, and the few data fields the UI reads. Keeps the
 * API response shape independent of the Prisma schema.
 */
export function serializeOnboardingState(session: SessionWithBroker) {
  const broker = toBrokerInfo(session.broker);
  const content = STEP_CONTENT[session.status];

  return {
    status: session.status,
    heading: content.heading,
    body: content.body({ broker, rejectionReason: session.rejectionReason }),
    primaryLabel: content.primaryLabel,
    showUploadField: content.showUploadField,
    canGoNext: canGoNext(session.status),
    canGoBack: canGoBack(session.status),
    canRestart: canRestart(session.status),
    broker,
    depositAmountClaimed: session.depositAmountClaimed ? Number(session.depositAmountClaimed) : null,
    rejectionReason: session.rejectionReason,
    updatedAt: session.updatedAt.toISOString(),
  };
}

export type SerializedOnboardingState = ReturnType<typeof serializeOnboardingState>;
