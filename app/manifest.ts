import type { MetadataRoute } from "next";

/**
 * PWA manifest.
 *
 * "Zero download" is the product's acquisition strategy, so the app must work
 * fully in the browser first — install is an optional upgrade for returning
 * users, never a gate. `display: "standalone"` gives repeat loggers an app-like
 * surface without ever asking a first-time scanner to install anything.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HeartLine — blood pressure, understood and tracked",
    short_name: "HeartLine",
    description:
      "A free, bilingual blood-pressure check and longitudinal tracker for Pakistan. Sixty seconds, no download, no cost.",
    start_url: "/en/care",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#edf4ef",
    theme_color: "#078679",
    categories: ["health", "medical", "lifestyle"],
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/pwa-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/pwa-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "My care", short_name: "Care", url: "/en/care", icons: [{ src: "/pwa-192.png", sizes: "192x192" }] },
      { name: "اردو", short_name: "اردو", url: "/ur/care", icons: [{ src: "/pwa-192.png", sizes: "192x192" }] },
    ],
  };
}
