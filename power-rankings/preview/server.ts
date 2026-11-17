// Preview: the real Rankings API over generated data. npm run preview → http://localhost:4330/signals/rankings
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { toNodeHandler } from "../server/node";
import { createRankingsApi, readRankingsConfig } from "../server/router";
import { createMemoryRankingsStore } from "../server/store";
import { PREVIEW_PROVIDERS, previewTrades } from "./data";

const api = createRankingsApi({ store: createMemoryRankingsStore(PREVIEW_PROVIDERS, previewTrades()), config: readRankingsConfig(process.env) });
const node = toNodeHandler(api);
createServer((req, res) => {
  if (req.url?.startsWith("/api/")) return node(req, res);
  if (req.url?.startsWith("/dist/")) {
    res.setHeader("content-type", req.url.endsWith(".css") ? "text/css" : "text/javascript");
    return res.end(readFileSync(new URL(`.${req.url.split("?")[0]}`, import.meta.url)));
  }
  res.setHeader("content-type", "text/html");
  res.end(readFileSync(new URL("./index.html", import.meta.url)));
}).listen(4330, () => console.log("Power Rankings preview: http://localhost:4330/signals/rankings"));
