import type { MetadataRoute } from "next";

import { SITE_ORIGIN } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/en/account",
        "/ur/account",
        "/en/admin",
        "/ur/admin",
        "/en/care",
        "/ur/care",
        "/en/passport",
        "/ur/passport",
        "/en/portal",
        "/ur/portal",
        "/en/results",
        "/ur/results",
        "/en/thank-you",
        "/ur/thank-you",
      ],
    },
    sitemap: `${SITE_ORIGIN}/sitemap.xml`,
    host: SITE_ORIGIN,
  };
}
