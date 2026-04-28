import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Enables Next.js standalone build — required by our Docker image which
  // copies `.next/standalone` + `.next/static` instead of running pnpm start.
  output: "standalone",
  reactStrictMode: true,
  // Allow article cover images from S3 + Logto avatars + arbitrary published assets
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "5sport-media.s3.ap-southeast-1.amazonaws.com" },
      { protocol: "https", hostname: "*.amazonaws.com" },
      { protocol: "https", hostname: "*.5bib.com" },
      { protocol: "https", hostname: "logto.io" },
      { protocol: "https", hostname: "picsum.photos" }, // seed/dev placeholder
    ],
  },
};

export default nextConfig;
