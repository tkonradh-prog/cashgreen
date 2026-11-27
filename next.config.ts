import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // turbopack config is for local dev only – not needed in production build
};

export default nextConfig;
