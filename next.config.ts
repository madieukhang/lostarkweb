import type { NextConfig } from "next";

// Static export: the lostark-web Worker serves out/ as assets and owns /auth/* and /api/*.
const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
