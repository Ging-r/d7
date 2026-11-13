import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Listing forms upload up to 6 photos of max 8 MB each.
      bodySizeLimit: "50mb",
    },
  },
};

export default nextConfig;
