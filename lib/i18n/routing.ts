import { defineRouting } from "next-intl/routing";

/**
 * Locale routing.
 *
 * English is the default because kiosk QR codes are printed once and scanned by
 * a mixed audience; every screen offers a one-tap switch to Urdu, and the choice
 * persists. `localePrefix: "always"` keeps URLs unambiguous, which matters when
 * a campaign QR code is printed on 500 posters and cannot be changed later.
 */
export const routing = defineRouting({
  locales: ["en", "ur"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

/** Text direction per locale. Drives `dir` on <html> and logical CSS. */
export const DIRECTION: Record<Locale, "ltr" | "rtl"> = {
  en: "ltr",
  ur: "rtl",
};

export const LOCALE_LABEL: Record<Locale, string> = {
  en: "English",
  ur: "اردو",
};
