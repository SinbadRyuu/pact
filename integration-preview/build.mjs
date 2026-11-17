// Builds preview.html: one self-contained file (scripts, styles and the site's fonts inlined).
import { build } from "esbuild";
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const here = path.dirname(new URL(import.meta.url).pathname);
const require = createRequire(import.meta.url);
// One React for everything: the modules' own node_modules must not bring a second copy.
const alias = {
  react: path.dirname(require.resolve("react/package.json")),
  "react-dom": path.dirname(require.resolve("react-dom/package.json")),
};
const out = await build({
  entryPoints: [path.join(here, "src/main.tsx")],
  bundle: true,
  format: "iife",
  jsx: "automatic",
  minify: true,
  write: false,
  outdir: "out",
  alias,
  define: { "process.env.NODE_ENV": '"production"' },
  logLevel: "warning",
});
const js = out.outputFiles.find((f) => f.path.endsWith(".js")).text;
const css = out.outputFiles.find((f) => f.path.endsWith(".css")).text;
const font = (file, family, weight, extra = "") =>
  `@font-face{font-family:"${family}";font-style:normal;font-display:swap;font-weight:${weight};${extra}src:url(data:font/woff2;base64,${readFileSync(
    path.join(here, "../investment-live-calls/preview/assets", file),
  ).toString("base64")}) format("woff2")}`;
const fonts = [
  font("oxanium-latin-wght-normal-BwpvAp5U.woff2", "Oxanium Variable", "200 800"),
  font("instrument-sans-latin-standard-normal-BVScPF0l.woff2", "Instrument Sans Variable", "400 700", "font-stretch:75% 100%;"),
  font("ibm-plex-mono-latin-400-normal-DMJ8VG8y.woff2", "IBM Plex Mono", "400"),
  font("ibm-plex-mono-latin-500-normal-DSY6xOcd.woff2", "IBM Plex Mono", "500 700"),
].join("\n");
const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>VT Impact: new pages preview</title>
<style>${fonts}\n${css}</style>
</head>
<body>
<div id="root"></div>
<script>${js.replace(/<\/script/gi, "<\\/script")}</script>
</body>
</html>`;
writeFileSync(path.join(here, "preview.html"), html);
console.log(`preview.html ${(html.length / 1024).toFixed(0)} KB`);
