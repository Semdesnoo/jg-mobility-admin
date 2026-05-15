import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JG Mobility Beheer",
    short_name: "JGM Beheer",
    description: "Intern beheerpaneel JG Mobility",
    start_url: "/admin/dashboard",
    display: "standalone",
    background_color: "#001337",
    theme_color: "#001337",
    icons: [
      {
        src: "/Favicon.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any maskable",
      },
      {
        src: "/Favicon.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any maskable",
      },
    ],
  };
}
