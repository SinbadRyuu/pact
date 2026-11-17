// Preview harness: the real pages with stand-in adapters. Not shipped.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { configureIndicators } from "../src/adapters";
import { IndicatorDetailPage } from "../src/IndicatorDetailPage";
import { IndicatorsPage } from "../src/IndicatorsPage";

const member = document.cookie.includes("preview_as=member");
configureIndicators({ signInHref: (next) => `/indicators?preview_signin=${encodeURIComponent(next)}` });

function Bar() {
  const set = (v: string) => {
    document.cookie = `preview_as=${v}; path=/`;
    location.reload();
  };
  const s = (on: boolean) => ({ padding: "6px 10px", borderRadius: 8, border: "1px solid #3ee8ff55", background: on ? "#3ee8ff" : "transparent", color: on ? "#000" : "#fff" });
  return (
    <div style={{ position: "fixed", insetInline: 0, bottom: 0, display: "flex", gap: 6, padding: 8, background: "#000c", zIndex: 9, font: "12px system-ui" }}>
      <button style={s(!member)} onClick={() => set("visitor")}>visitor</button>
      <button style={s(member)} onClick={() => set("member")}>member</button>
    </div>
  );
}

const m = /^\/indicators\/([^/]+)/.exec(location.pathname);
createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {m ? <IndicatorDetailPage slug={decodeURIComponent(m[1])} /> : <IndicatorsPage />}
    <Bar />
  </StrictMode>,
);
