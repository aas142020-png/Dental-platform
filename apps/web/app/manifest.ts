import type { MetadataRoute } from "next";
import { color } from "@dental/design-tokens";

// Installable PWA. Neutral placeholder icons (no brand decided). No offline content caching in Sprint 1.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "dental-platform",
    short_name: "dental-platform",
    description: "Dental education and clinical reference",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: color.light.surface,
    theme_color: color.light.surface,
    dir: "auto",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
