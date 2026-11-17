// Starts the preview server (TypeScript, via tsx).
import { spawn } from "node:child_process";
spawn("npx", ["tsx", "preview/server.ts"], { stdio: "inherit" });
