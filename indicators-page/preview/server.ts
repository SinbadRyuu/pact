// Preview server: the real API with sample indicators in memory. Signed in/out via the bar at the bottom.
//   npm run preview   then open http://localhost:4320/indicators
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { toNodeHandler } from "../server/node";
import { createIndicatorsApi } from "../server/router";
import { createMemoryIndicatorStore } from "../server/store";
import { INDICATORS } from "../test/fixtures";

const extra = [
  { ...INDICATORS[1], id: "p4", slug: "liquidity-sweeps", name: "Liquidity Sweeps", description: "Flags sweeps of the previous day's high and low, with alerts.", platform: "tradingview" as const, tradingviewUrl: "https://www.tradingview.com/", fileUrl: null, accessLevel: "free" as const, version: "1.2", downloadCount: 1284, updatedAt: "2026-11-12T00:00:00.000Z" },
];
const store = createMemoryIndicatorStore([...INDICATORS.map((x) => ({ ...x, screenshots: x.slug === "vt-structure" ? ["/shot1.svg", "/shot2.svg"] : [] })), ...extra]);
const api = createIndicatorsApi({
  store,
  getUser: async (req) => (/preview_as=member/.test(req.headers.get("cookie") ?? "") ? { id: "member" } : null),
  signFile: async (u) => (u.startsWith("storage:") ? `https://example.com/signed/${u.slice(8)}` : u),
});
const node = toNodeHandler(api);
const shot = (hue: number) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 100"><rect width="160" height="100" fill="#0a0e22"/><path d="M0 80 C40 70 60 30 90 45 S140 10 160 20" stroke="hsl(${hue} 90% 65%)" stroke-width="2" fill="none"/></svg>`;

createServer((req, res) => {
  if (req.url?.startsWith("/api/")) return node(req, res);
  if (req.url === "/shot1.svg" || req.url === "/shot2.svg") {
    res.setHeader("content-type", "image/svg+xml");
    return res.end(shot(req.url === "/shot1.svg" ? 190 : 260));
  }
  if (req.url?.startsWith("/dist/")) {
    res.setHeader("content-type", req.url.endsWith(".css") ? "text/css" : "text/javascript");
    return res.end(readFileSync(new URL(`.${req.url.split("?")[0]}`, import.meta.url)));
  }
  res.setHeader("content-type", "text/html");
  res.end(readFileSync(new URL("./index.html", import.meta.url)));
}).listen(4320, () => console.log("Indicators preview: http://localhost:4320/indicators"));
