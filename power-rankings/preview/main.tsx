// Preview harness: the real pages, routed by path. Not shipped.
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { ProviderPage } from "../src/ProviderPage";
import { RankingsPage } from "../src/RankingsPage";

const m = /^\/signals\/providers\/([^/]+)/.exec(location.pathname);
createRoot(document.getElementById("root")!).render(<StrictMode>{m ? <ProviderPage slug={decodeURIComponent(m[1])} /> : <RankingsPage />}</StrictMode>);
