// Regenerates preview.html (and the Vercel preview copy at
// apps/web/public/investment/index.html) from pact-investment-tab.html.
// Run:  node build-preview.js
// (Only needed if you edit pact-investment-tab.html and want an updated preview.)
const fs = require("fs");
const path = require("path");
const snippet = fs.readFileSync(path.join(__dirname, "pact-investment-tab.html"), "utf8");
const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PACT Investment Tab — Preview</title>
<style>html,body{margin:0;padding:0;background:#0d0a15}</style>
</head>
<body>
<!-- PREVIEW ONLY. Do not copy this file into the website — copy pact-investment-tab.html instead. -->
${snippet}
</body>
</html>
`;
fs.writeFileSync(path.join(__dirname, "preview.html"), page);
const webDir = path.join(__dirname, "..", "apps", "web", "public", "investment");
fs.mkdirSync(webDir, { recursive: true });
fs.writeFileSync(path.join(webDir, "index.html"), page
  .replace("<title>PACT Investment Tab — Preview</title>", "<title>Investment — PACT</title>")
  .replace("<!-- PREVIEW ONLY. Do not copy this file into the website — copy pact-investment-tab.html instead. -->\n", ""));
console.log("preview.html and apps/web/public/investment/index.html updated");
