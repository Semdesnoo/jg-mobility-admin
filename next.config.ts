import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Uniek per build. De service worker wordt onder deze naam geregistreerd, zodat de
  // browser bij een nieuwe versie ook echt gaat kijken of er een update is — met een
  // ongewijzigde bestandsnaam slaat hij die controle soms een dag over.
  env: {
    NEXT_PUBLIC_BUILD_ID: process.env.VERCEL_GIT_COMMIT_SHA ?? `dev-${Date.now()}`,
  },
  async headers() {
    return [
      {
        // De service worker mag nooit uit de cache komen: dat is precies het bestand
        // dat moet vertellen dát er iets veranderd is.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
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
