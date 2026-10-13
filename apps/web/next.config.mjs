/** @type {import('next').NextConfig} */
const nextConfig = {
  // @pact/core ships plain TypeScript (no build step), so Next.js needs to
  // transpile it itself rather than expecting compiled JS in node_modules.
  transpilePackages: ["@pact/core"],

  // The Investment tab is a standalone page in public/investment/index.html.
  // Serve it at /investment (and /investment/).
  async rewrites() {
    return [
      { source: "/investment", destination: "/investment/index.html" },
      { source: "/investment/", destination: "/investment/index.html" },
    ];
  },
};

export default nextConfig;
