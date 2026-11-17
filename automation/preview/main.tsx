// Preview harness: the real pages, wired with stand-in adapters. Not shipped.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { configureAutomation } from "../src/adapters";
import { AutomationPage } from "../src/AutomationPage";
import { SubscribePage } from "../src/SubscribePage";
import { SuccessPage } from "../src/SuccessPage";

const who = /preview_as=([a-z_]+)/.exec(document.cookie)?.[1] ?? "signed_out";

configureAutomation({
  useSession: () => ({ isPending: false, data: { state: who === "signed_out" ? "signed_out" : "signed_in" } }),
  signUpHref: (next) => `/automation?preview_signup=1&next=${encodeURIComponent(next)}`,
});

const PERSONAS = ["signed_out", "signed_in", "subscribed", "cancelling", "payment_failed", "cancelled"];

function Bar() {
  return (
    <div style={{ position: "fixed", insetInline: 0, bottom: 0, display: "flex", gap: 6, padding: 8, overflowX: "auto", background: "#000c", zIndex: 9, font: "12px system-ui" }}>
      {PERSONAS.map((p) => (
        <button
          key={p}
          onClick={() => {
            document.cookie = `preview_as=${p}; path=/`;
            location.reload();
          }}
          style={{ flex: "none", padding: "6px 10px", borderRadius: 8, border: "1px solid #3ee8ff55", background: p === who ? "#3ee8ff" : "transparent", color: p === who ? "#000" : "#fff" }}
        >
          {p.replace("_", " ")}
        </button>
      ))}
    </div>
  );
}

const path = location.pathname;
const Page = path.startsWith("/automation/success") ? SuccessPage : path.startsWith("/automation/subscribe") ? SubscribePage : AutomationPage;

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Page />
    <Bar />
  </StrictMode>,
);
