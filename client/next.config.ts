import type { NextConfig } from "next";

// The browser only ever talks to this Next.js origin; /api and /assets are proxied
// to the FastAPI server. Rewrites are resolved at build time for `next build`,
// so set API_INTERNAL_URL before building for production.
const apiOrigin = (process.env.API_INTERNAL_URL || "http://127.0.0.1:8000").replace(/\/$/, "");

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // The floating dev badge overlaps the mobile header/bottom nav; build errors still surface.
  devIndicators: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return [
      { source: "/api/:path*", destination: `${apiOrigin}/api/:path*` },
      { source: "/assets/:path*", destination: `${apiOrigin}/assets/:path*` },
    ];
  },
};

export default nextConfig;
