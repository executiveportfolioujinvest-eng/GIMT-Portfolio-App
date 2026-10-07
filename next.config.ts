import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Company logos returned by the Finnhub profile endpoint
    remotePatterns: [
      { protocol: "https", hostname: "static2.finnhub.io" },
      { protocol: "https", hostname: "static.finnhub.io" },
    ],
  },
};

export default nextConfig;
