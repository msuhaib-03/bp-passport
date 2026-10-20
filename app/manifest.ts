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
    orientation: "portrait",
    background_color: "#f4f7fa",
    theme_color: "#0c1c30",
    categories: ["health", "medical", "lifestyle"],
    lang: "en",
    dir: "ltr",
    icons: [
      { src: "/logo-full.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}
