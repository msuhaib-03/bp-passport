"use client";

import { useLocale, useTranslations } from "next-intl";
import { Languages } from "lucide-react";

import { usePathname, useRouter } from "@/lib/i18n/navigation";
import type { Locale } from "@/lib/i18n/routing";

/**
 * Language toggle.
 *
 * A single button, not a dropdown. There are exactly two languages, and a
 * dropdown would cost an extra tap and an extra decision for a user who may not
 * read the current language. The label is always written in the *target*
 * language ("اردو میں دیکھیں" while in English) so it is legible to the person
 * who needs it.
 */
export function LocaleSwitch({ className }: { className?: string }) {
  const t = useTranslations("common");
  const locale = useLocale() as Locale;
  const pathname = usePathname();
  const router = useRouter();

  const target: Locale = locale === "en" ? "ur" : "en";

  return (
    <button
      type="button"
      onClick={() => router.replace(pathname, { locale: target })}
      className={`inline-flex min-h-[3rem] items-center gap-2 rounded-full border-2 border-ink-200 bg-white px-4 text-sm font-semibold text-ink-800 transition-colors hover:border-ink-400 ${className ?? ""}`}
      lang={target}
    >
      <Languages size={18} aria-hidden className="shrink-0" />
      {t("switchLanguage")}
    </button>
  );
}
