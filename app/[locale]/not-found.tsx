import { ArrowRight, Compass } from "lucide-react";
import { getLocale } from "next-intl/server";

import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { Link } from "@/lib/i18n/navigation";

export default async function NotFound() {
  const locale = await getLocale();
  const ur = locale === "ur";
  return (
    <main className="min-h-dvh bg-[#f2f7f4]">
      <MarketingHeader locale={locale} />
      <section className="mx-auto flex min-h-[68vh] max-w-4xl items-center px-5 py-16 text-center sm:px-8">
        <div className="w-full">
          <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#dff3ee] text-[#078679]"><Compass size={38} aria-hidden /></span>
          <p className="mt-7 text-sm font-extrabold tracking-[.18em] text-[#078679] uppercase">404</p>
          <h1 className="mt-3 font-serif text-4xl text-[#07383a] sm:text-6xl">{ur ? "یہ صفحہ نہیں ملا۔" : "This page took a wrong turn."}</h1>
          <p className="mx-auto mt-5 max-w-xl leading-7 text-[#55706a]">{ur ? "لنک شاید پرانا ہے یا پتہ غلط لکھا گیا ہے۔ آپ ہوم پر واپس جا سکتے ہیں یا صحت چیک شروع کر سکتے ہیں۔" : "The link may be out of date or the address may be mistyped. Return home or start a fresh health check."}</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link href="/" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#078679] px-6 font-extrabold text-white">{ur ? "ہوم پر جائیں" : "Go home"}<ArrowRight size={18} className="rtl:rotate-180" aria-hidden /></Link>
            <Link href="/audit" className="inline-flex min-h-14 items-center justify-center rounded-xl border border-[#b9d6cf] bg-white px-6 font-bold text-[#176b63]">{ur ? "صحت چیک شروع کریں" : "Start health check"}</Link>
          </div>
        </div>
      </section>
      <SiteFooter locale={locale} />
    </main>
  );
}
