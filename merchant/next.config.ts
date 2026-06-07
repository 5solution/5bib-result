import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // standalone only for Docker/VPS production builds — not local dev
  // (next start doesn't work with standalone; use node .next/standalone/server.js on VPS)
  output: process.env.BUILD_STANDALONE === "1" ? "standalone" : undefined,
};

export default nextConfig;
