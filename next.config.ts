import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // AVIF eerst (≈20% kleiner dan WebP), met WebP als fallback. Zonder deze regel
    // serveert Next 16 standaard alléén WebP.
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "prod.pictures.autoscout24.net",
      },
      {
        // Gedeelde foto-opslag (Vercel Blob). Nodig zodat Next/Image deze foto's mag
        // verkleinen + naar WebP/AVIF converteren i.p.v. de full-size originelen te serveren.
        protocol: "https",
        hostname: "**.public.blob.vercel-storage.com",
      },
    ],
  },
};

export default nextConfig;
