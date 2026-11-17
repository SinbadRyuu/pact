// Next.js: merge into next.config.js. `permanent: true` would send 308; statusCode forces a true 301.
module.exports = {
  async redirects() {
    return ["/chart", "/charts", "/app/chart", "/app/charts", "/chart/:path*", "/app/chart/:path*"].map((source) => ({
      source,
      destination: "/indicators",
      statusCode: 301,
    }));
  },
};
