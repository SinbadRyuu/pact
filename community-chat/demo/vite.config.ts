import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// A local preview of the community chat with an in-browser backend. Run `npm run demo`.
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  plugins: [react()],
  // ASCII output keeps the bundle intact however the page's charset is declared.
  esbuild: { charset: "ascii" },
  server: { port: 5175, host: true },
  preview: { port: 5175, host: true },
  build: { outDir: "dist", emptyOutDir: true },
});
