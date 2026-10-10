import type { NextConfig } from "next";

// Vercel builds the app directly. Standalone tracing needs Windows symlink
// privileges that are not available in this workspace.
const nextConfig: NextConfig = {
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
