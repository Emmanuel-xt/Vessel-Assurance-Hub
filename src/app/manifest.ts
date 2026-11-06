import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";

// Web app manifest: makes the app installable (PWA, CLAUDE.md §11). Icons are drawn from the same mark as
// src/components/brand/logo.tsx. Offline sync is out of scope for v1, so there is no service worker yet.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: "Assurance Hub",
    description: "LOD1 assurance for offshore vessel operations.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f8fafd",
    theme_color: "#0d2b50",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
