import type { MetadataRoute } from "next";

import { absoluteUrl } from "@/lib/site";

const PUBLIC_ROUTES = ["", "/contact", "/privacy", "/terms"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_ROUTES.flatMap((route) => (["en", "ur"] as const).map((locale) => ({
    url: absoluteUrl(`/${locale}${route}`),
    lastModified: new Date("2026-10-22"),
    changeFrequency: route === "" ? "weekly" as const : "monthly" as const,
    priority: route === "" ? 1 : 0.6,
    alternates: {
      languages: {
        en: absoluteUrl(`/en${route}`),
        ur: absoluteUrl(`/ur${route}`),
      },
    },
  })));
}
