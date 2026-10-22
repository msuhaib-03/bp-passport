import type { Metadata } from "next";
import { ArrowRight, CircleCheckBig } from "lucide-react";
import { setRequestLocale } from "next-intl/server";

import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Link } from "@/lib/i18n/navigation";

export const metadata: Metadata = {
  title: "Thank you",
  description: "Your message has been delivered to the BP Passport team.",
  robots: { index: false, follow: false },
};

export default async function ThankYouPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ur = locale === "ur";
  return (
    <main className="min-h-dvh bg-[#f2f7f4]">
      <MarketingHeader locale={locale} />
      <section className="mx-auto flex min-h-[68vh] max-w-3xl items-center px-5 py-16 text-center sm:px-8">
        <div className="w-full rounded-3xl border border-[#d4e7e0] bg-white p-7 shadow-[0_20px_60px_rgb(6_56_58/0.08)] sm:p-12">
          <CircleCheckBig size={56} className="mx-auto text-[#078679]" aria-hidden />
          <p className="mt-6 text-xs font-extrabold tracking-[.16em] text-[#078679] uppercase">{ur ? "پیغام موصول ہو گیا" : "Message received"}</p>
          <h1 className="mt-3 font-serif text-4xl text-[#07383a] sm:text-5xl">{ur ? "شکریہ۔" : "Thank you."}</h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-[#55706a]">{ur ? "آپ کا پیغام بی پی پاسپورٹ ٹیم تک پہنچ گیا ہے۔ ہم مناسب وقت میں جواب دیں گے۔" : "Your message has reached the BP Passport team. We’ll respond as soon as it’s practical."}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#078679] px-6 font-extrabold text-white">{ur ? "ہوم پر جائیں" : "Return home"}<ArrowRight size={18} className="rtl:rotate-180" aria-hidden /></Link>
            <Link href="/audit" className="inline-flex min-h-14 items-center justify-center rounded-xl border border-[#b9d6cf] px-6 font-bold text-[#176b63]">{ur ? "صحت چیک شروع کریں" : "Start a health check"}</Link>
          </div>
        </div>
      </section>
      <SiteFooter locale={locale} />
    </main>
  );
}
