"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

import { CONSENT_EVENT, CONSENT_STORAGE_KEY } from "@/components/privacy/CookieBanner";

const ANONYMOUS_ID_KEY = "bpp.analytics-id.v1";

export function Analytics() {
  const pathname = usePathname();
  const lastPath = useRef("");

  useEffect(() => {
    const projectToken = process.env.NEXT_PUBLIC_POSTHOG_KEY;
    const host = (process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://eu.i.posthog.com").replace(/\/$/, "");
    if (!projectToken) return;

    function capture() {
      let consent: string | null = null;
      try { consent = window.localStorage.getItem(CONSENT_STORAGE_KEY); } catch { return; }
      if (consent !== "analytics" || lastPath.current === pathname) return;

      let distinctId = window.localStorage.getItem(ANONYMOUS_ID_KEY);
      if (!distinctId) {
        distinctId = crypto.randomUUID();
        window.localStorage.setItem(ANONYMOUS_ID_KEY, distinctId);
      }

      lastPath.current = pathname;
      void fetch(`${host}/i/v0/e/`, {
        method: "POST",
        mode: "cors",
        credentials: "omit",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: projectToken,
          event: "$pageview",
          properties: {
            distinct_id: distinctId,
            $current_url: `${window.location.origin}${pathname}`,
            $pathname: pathname,
            product: "bp-passport",
          },
        }),
      }).catch(() => undefined);
    }

    capture();
    window.addEventListener(CONSENT_EVENT, capture);
    return () => window.removeEventListener(CONSENT_EVENT, capture);
  }, [pathname]);

  return null;
}
