import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Vercel restores .next/cache between builds; with Turbopack's build cache on (default since
    // 16.3) a production build shipped stale CSS from the previous globals.css. Always compile fresh.
    turbopackFileSystemCacheForBuild: false,
  },
};

export default nextConfig;
