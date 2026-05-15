import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "prod.pictures.autoscout24.net",
      },
    ],
  },
};

export default nextConfig;
