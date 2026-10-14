import type { NextConfig } from "next";

// Vercel builds the app directly. Standalone tracing needs Windows symlink
// privileges that are not available in this workspace.
const nextConfig: NextConfig = {
  devIndicators: false,
  // Allow CI/QC builds to use an isolated output while `next dev` is running.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  eslint: { ignoreDuringBuilds: true },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;
