import type { MetadataRoute } from "next";

/** The installed app opens the same responsive product as the website. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Preserve the identity of earlier installs, whose implicit id was the old
    // /en/care start URL, while moving future launches to the real home page.
    id: "/en/care",
    name: "BP Passport",
    short_name: "BP Passport",
    description:
      "A free, bilingual blood-pressure check and longitudinal tracker for Pakistan. Sixty seconds, no download, no cost.",
    start_url: "/en",
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
      { name: "Open BP Passport", short_name: "Home", url: "/en", icons: [{ src: "/pwa-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Sign in or create account", short_name: "Account", url: "/en/account", icons: [{ src: "/pwa-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "Patient dashboard", short_name: "Care", url: "/en/care", icons: [{ src: "/pwa-192.png", sizes: "192x192", type: "image/png" }] },
      { name: "اردو میں کھولیں", short_name: "اردو", url: "/ur", icons: [{ src: "/pwa-192.png", sizes: "192x192", type: "image/png" }] },
    ],
  };
}
