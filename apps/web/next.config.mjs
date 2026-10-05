/** @type {import('next').NextConfig} */
const nextConfig = {
  // @pact/core ships plain TypeScript (no build step), so Next.js needs to
  // transpile it itself rather than expecting compiled JS in node_modules.
  transpilePackages: ["@pact/core"],
};

export default nextConfig;
