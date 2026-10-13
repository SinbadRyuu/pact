"use client";

import { OnboardingBot } from "@/components/onboarding-bot";

/**
 * Development/testing shell. This page is NOT part of the embeddable
 * component — it's scaffolding so you can see the widget working in a
 * browser. Note the surrounding content deliberately uses different fonts
 * and colors to a real site, to prove the widget's styling stays contained.
 */
export default function DevShellPage() {
  async function resetTestSession() {
    await fetch("/api/dev/reset-session", { method: "POST" });
    window.location.reload();
  }

  return (
    <div style={{ minHeight: "100vh", padding: "40px 16px" }}>
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <header style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: 28, margin: 0 }}>
            PACT Onboarding — Dev / Test Shell
          </h1>
          <p style={{ color: "#52525b", fontSize: 14, marginTop: 8 }}>
            This page is a throwaway test harness, styled differently on purpose (serif heading, grey
            background) to prove the widget below doesn&apos;t leak styles in or out. The widget itself is
            the only thing that will be embedded into the real site.
          </p>
          <button
            type="button"
            onClick={resetTestSession}
            style={{
              marginTop: 12,
              fontSize: 13,
              background: "#18181b",
              color: "#fff",
              border: "none",
              borderRadius: 6,
              padding: "6px 12px",
              cursor: "pointer",
            }}
          >
            Reset test session (start onboarding over as a new visitor)
          </button>
        </header>

        <main style={{ display: "flex", justifyContent: "center" }}>
          <OnboardingBot />
        </main>

        <footer style={{ marginTop: 40, fontSize: 12, color: "#a1a1aa", textAlign: "center" }}>
          apps/web/src/app/page.tsx — safe to redesign freely, it ships with the dev shell only.
        </footer>
      </div>
    </div>
  );
}
