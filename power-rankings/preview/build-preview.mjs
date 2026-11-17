// Bundles the preview page. Run from automation/: node preview/build-preview.mjs
import { build } from "esbuild";
await build({
  entryPoints: ["preview/main.tsx"],
  bundle: true,
  format: "esm",
  jsx: "automatic",
  outdir: "preview/dist",
  logLevel: "info",
});
