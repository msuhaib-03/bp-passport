"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { Cookie } from "lucide-react";

import { Link } from "@/lib/i18n/navigation";

export const CONSENT_STORAGE_KEY = "bpp.cookie-consent.v1";
export const CONSENT_EVENT = "bpp:consent-changed";

export type ConsentChoice = "essential" | "analytics";

export function CookieBanner() {
  const locale = useLocale();
  const [state, setState] = useState<"loading" | "prompt" | "dismissed">("loading");

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        const saved = window.localStorage.getItem(CONSENT_STORAGE_KEY);
        setState(saved === "analytics" || saved === "essential" ? "dismissed" : "prompt");
      } catch {
        setState("prompt");
      }
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  function choose(next: ConsentChoice) {
    try { window.localStorage.setItem(CONSENT_STORAGE_KEY, next); } catch { /* Essential UI still works. */ }
    setState("dismissed");
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: next }));
  }

  if (state !== "prompt") return null;

  const ur = locale === "ur";
  return (
    <aside aria-label={ur ? "کوکی ترجیحات" : "Cookie preferences"} className="fixed inset-x-3 bottom-3 z-[70] mx-auto max-w-3xl rounded-2xl border border-[#bad8d1] bg-white p-4 shadow-2xl sm:bottom-5 sm:p-5">
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-[#e4f6f2] text-[#078679]"><Cookie size={20} aria-hidden /></span>
        <div className="min-w-0 flex-1">
          <h2 className="font-extrabold text-[#07383a]">{ur ? "آپ کی رازداری، آپ کا انتخاب" : "Your privacy, your choice"}</h2>
          <p className="mt-1 text-sm leading-6 text-[#56706b]">
            {ur
              ? "ضروری اسٹوریج ایپ کو چلانے کے لیے استعمال ہوتی ہے۔ آپ چاہیں تو گمنام صفحہ جاتی تجزیات کی اجازت دے سکتے ہیں؛ ہم طبی جوابات یا بلڈ پریشر ریڈنگز تجزیات میں نہیں بھیجتے۔"
              : "Essential storage keeps the app working. You may also allow anonymous page analytics; health answers and blood-pressure readings are never sent to analytics."}
            {" "}<Link href="/privacy" className="font-bold text-[#078679] underline underline-offset-2">{ur ? "تفصیل" : "Learn more"}</Link>
          </p>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => choose("essential")} className="min-h-12 rounded-xl border border-[#aacdc5] px-4 text-sm font-bold text-[#285b56]">
              {ur ? "صرف ضروری" : "Essential only"}
            </button>
            <button type="button" onClick={() => choose("analytics")} className="min-h-12 rounded-xl bg-[#078679] px-4 text-sm font-bold text-white">
              {ur ? "گمنام تجزیات کی اجازت" : "Allow anonymous analytics"}
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
