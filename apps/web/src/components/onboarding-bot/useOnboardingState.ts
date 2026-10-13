"use client";

import { useCallback, useEffect, useState } from "react";
import type { OnboardingState } from "./types";

const FALLBACK_ERROR = "Something went wrong. Please try again.";

async function parseErrorMessage(res: Response): Promise<string> {
  try {
    const data = await res.json();
    return typeof data?.error === "string" ? data.error : FALLBACK_ERROR;
  } catch {
    return FALLBACK_ERROR;
  }
}

export function useOnboardingState(apiBaseUrl: string) {
  const [state, setState] = useState<OnboardingState | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionPending, setActionPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${apiBaseUrl}/api/onboarding/state`, { credentials: "include" });
      if (!res.ok) throw new Error(await parseErrorMessage(res));
      setState(await res.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : FALLBACK_ERROR);
    } finally {
      setLoading(false);
    }
  }, [apiBaseUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const sendAction = useCallback(
    async (action: "NEXT" | "BACK" | "RESTART") => {
      setActionPending(true);
      setError(null);
      try {
        const res = await fetch(`${apiBaseUrl}/api/onboarding/step`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        });
        if (!res.ok) throw new Error(await parseErrorMessage(res));
        setState(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : FALLBACK_ERROR);
      } finally {
        setActionPending(false);
      }
    },
    [apiBaseUrl]
  );

  const submitDeposit = useCallback(
    async (depositAmountClaimed: number, file: File) => {
      setActionPending(true);
      setError(null);
      try {
        const form = new FormData();
        form.set("depositAmountClaimed", String(depositAmountClaimed));
        form.set("screenshot", file);
        const res = await fetch(`${apiBaseUrl}/api/onboarding/upload`, {
          method: "POST",
          credentials: "include",
          body: form,
        });
        if (!res.ok) throw new Error(await parseErrorMessage(res));
        setState(await res.json());
      } catch (err) {
        setError(err instanceof Error ? err.message : FALLBACK_ERROR);
      } finally {
        setActionPending(false);
      }
    },
    [apiBaseUrl]
  );

  return {
    state,
    loading,
    actionPending,
    error,
    next: () => sendAction("NEXT"),
    back: () => sendAction("BACK"),
    restart: () => sendAction("RESTART"),
    submitDeposit,
    reload: load,
  };
}
