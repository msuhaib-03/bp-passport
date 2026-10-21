import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import { DIRECTION, routing, type Locale } from "@/lib/i18n/routing";
import { PwaRegister } from "@/components/pwa/PwaRegister";
import { GlobalLocaleSwitch } from "@/components/ui/GlobalLocaleSwitch";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export const metadata: Metadata = {
  title: {
    default: "BP Passport — understand and track your blood pressure",
    template: "%s · BP Passport",
  },
  description:
    "A free, bilingual blood-pressure check for Pakistan. Sixty seconds, no download, no cost. Understand your reading and track it over time.",
  applicationName: "BP Passport",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "BP Passport", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#078679",
  width: "device-width",
  initialScale: 1,
  // Zoom is never disabled. Users over 50 pinch to read, and locking scale is
  // an accessibility failure that disproportionately affects the population
  // this product exists for.
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  setRequestLocale(locale);
  const dir = DIRECTION[locale as Locale];

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        {/* Urdu webfonts are fetched only for the Urdu locale — Nastaliq is a
            large file and an English-only user should never pay for it. */}
        {locale === "ur" && (
          <>
            <link rel="preconnect" href="https://fonts.googleapis.com" />
            <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
            <link
              rel="stylesheet"
              href="https://fonts.googleapis.com/css2?family=Noto+Nastaliq+Urdu:wght@400;700&family=Noto+Sans+Arabic:wght@400;500;700&display=swap"
            />
          </>
        )}
      </head>
      <body>
        <NextIntlClientProvider>
          {/* Skip link: the audit is a long form, and keyboard users should not
              have to tab through the header on every question. */}
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ink-900 focus:px-4 focus:py-3 focus:text-white"
          >
            Skip to content
          </a>
          <div id="main">{children}</div>
          <GlobalLocaleSwitch />
          <PwaRegister />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
