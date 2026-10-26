// Builds the preview into one self-contained file, preview/dist/index.html (site styles, fonts and script inlined).
//
//   cd site-schedule/preview
//   npm i --no-save esbuild react react-dom react-router-dom @tanstack/react-query
//   node build-preview.mjs        # then open dist/index.html in a browser
import { build } from "esbuild";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// The live site's stylesheet and fonts, saved once for the Live calls preview.
const siteAssets = join(here, "../../investment-live-calls/preview/assets");
const out = join(here, "dist");
mkdirSync(out, { recursive: true });

const result = await build({
  entryPoints: [join(here, "main.tsx")],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  minify: true,
  write: false,
  outdir: out,
  loader: { ".jpg": "dataurl", ".html": "text" },
  define: { "process.env.NODE_ENV": '"production"' },
  // Shared folders outside preview/ (src/, the Live calls module) resolve packages from here too.
  nodePaths: [join(here, "node_modules")],
  logLevel: "warning",
});
const file = (ext) => result.outputFiles.find((f) => f.path.endsWith(ext))?.text ?? "";

// Inline the fonts the stylesheet points at; anything not saved locally falls back to the system font.
const site = readFileSync(join(siteAssets, "site.css"), "utf8").replace(/url\(\/assets\/([^)]+)\)/g, (_, name) => {
  const p = join(siteAssets, name);
  if (!existsSync(p) || !name.endsWith(".woff2")) return "url(about:blank)";
  return `url(data:font/woff2;base64,${readFileSync(p).toString("base64")})`;
});

const html = `<!doctype html>
<html lang="en-GB" data-theme="future" data-scheme="dark">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>VT Impact schedule (preview)</title>
<style>${site}</style>
<style>${file(".css")}</style>
<style>
html, body { background: var(--color-shell-bg, #05071a); }
#toast { position: fixed; left: 50%; bottom: 84px; transform: translate(-50%, 20px); opacity: 0; padding: 10px 16px; border-radius: 10px; background: #062419; color: #3dffb2; border: 1px solid #3dffb266; font: 600 14px/1.2 var(--font-sans); transition: .25s; pointer-events: none; z-index: 99 }
#toast[data-on="1"] { opacity: 1; transform: translate(-50%, 0) }
.pv-bar { position: fixed; z-index: 60; left: 50%; translate: -50% 0; bottom: calc(12px + env(safe-area-inset-bottom, 0px)); display: flex; flex-wrap: wrap; justify-content: center; align-items: center; gap: 6px; width: max-content; max-width: calc(100vw - 24px); padding: 6px 8px; border-radius: 14px; background: #0b0d22ee; border: 1px solid #3ee8ff66; box-shadow: 0 12px 40px -12px #000; font: 600 12px/1 "Instrument Sans Variable", system-ui, sans-serif; color: #e8f3ff; backdrop-filter: blur(8px) }
.pv-bar__label { padding: 0 4px; color: #ff4fd8; text-transform: uppercase; letter-spacing: .08em; font-size: 11px }
.pv-seg { display: flex; border: 1px solid #ffffff26; border-radius: 9px; overflow: hidden }
.pv-seg button, .pv-seg a { all: unset; cursor: pointer; padding: 7px 9px; color: #b9c3dd }
.pv-seg button[aria-pressed="true"] { background: #3ee8ff; color: #04121a }
.pv-seg :focus-visible { outline: 2px solid #ff4fd8; outline-offset: -2px }
.portal__footer { padding-bottom: 84px }
</style>
</head>
<body>
<div id="root"></div>
<div id="toast" role="status" aria-live="polite"></div>
<script type="module">${file(".js").replace(/<\/script/g, "<\\/script")}</script>
</body>
</html>
`;
writeFileSync(join(out, "index.html"), html);
console.log(`dist/index.html ${Math.round(html.length / 1024)} KB`);
