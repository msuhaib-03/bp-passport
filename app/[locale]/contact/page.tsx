import type { Metadata } from "next";
import { ExternalLink, Linkedin, MapPin, MessageCircle } from "lucide-react";
import { setRequestLocale } from "next-intl/server";

import { ContactForm } from "@/components/marketing/ContactForm";
import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";
import { PUBLIC_LOCATION, TEAM } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  description: "Contact the BP Passport team in Karachi for product feedback, partnerships, pilot programmes, or technical questions.",
};

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const ur = locale === "ur";

  return (
    <main className="min-h-dvh bg-[#f2f7f4]">
      <MarketingHeader locale={locale} back />
      <section className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[.8fr_1.2fr] lg:px-10">
        <div>
          <p className="text-xs font-extrabold tracking-[.16em] text-[#078679] uppercase">{ur ? "رابطہ" : "Contact"}</p>
          <h1 className="mt-3 font-serif text-4xl tracking-tight text-[#07383a] sm:text-5xl">{ur ? "ہم آپ کی بات سننا چاہتے ہیں۔" : "We’d like to hear from you."}</h1>
          <p className="mt-5 text-lg leading-8 text-[#55706a]">{ur ? "پروڈکٹ فیڈبیک، شراکت داری، پائلٹ پروگرام یا تکنیکی سوال کے لیے پیغام بھیجیں۔" : "Send a note about product feedback, partnerships, pilot programmes, or a technical question."}</p>
          <div className="mt-8 rounded-2xl border border-[#d5e7e1] bg-[#e8f6f2] p-5">
            <p className="flex gap-3 font-bold text-[#07383a]"><MapPin size={20} className="mt-0.5 shrink-0 text-[#078679]" aria-hidden />{PUBLIC_LOCATION}</p>
            <p className="mt-2 text-sm leading-6 text-[#55706a]">{ur ? "یہ ہماری عوامی پروڈکٹ ٹیم کا مقام ہے؛ طبی یا ہنگامی مدد کے لیے رابطہ پتہ نہیں۔" : "This is our public product-team location, not an address for medical care or emergencies."}</p>
          </div>
          <p className="mt-6 flex gap-2 text-sm leading-6 text-[#55706a]"><MessageCircle size={18} className="mt-0.5 shrink-0 text-[#078679]" aria-hidden />{ur ? "طبی ہنگامی حالت میں اس فارم کا انتظار نہ کریں—ریسکیو 1122 پر کال کریں۔" : "For a medical emergency, do not wait for this form—call Rescue 1122."}</p>
        </div>
        <ContactForm locale={locale} />
      </section>

      <section id="team" className="mx-auto max-w-7xl scroll-mt-10 px-5 pb-16 sm:px-8 lg:px-10">
        <h2 className="text-2xl font-extrabold text-[#07383a]">{ur ? "براہِ راست رابطہ" : "Contact the team directly"}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {TEAM.map((member) => (
            <article key={member.linkedin} className="rounded-2xl border border-[#d6e7e1] bg-white p-5">
              <h3 className="text-lg font-extrabold text-[#07383a]">{member.name}</h3>
              <p className="text-sm text-[#607570]">{member.role}</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <a href={member.linkedin} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#078679] px-4 text-sm font-bold text-white"><Linkedin size={17} aria-hidden /> LinkedIn <ExternalLink size={12} aria-hidden /></a>
                <a href={member.portfolio} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-xl border border-[#bad6cf] px-4 text-sm font-bold text-[#176b63]">{ur ? "پورٹ فولیو" : "Portfolio"} <ExternalLink size={12} aria-hidden /></a>
              </div>
            </article>
          ))}
        </div>
      </section>
      <SiteFooter locale={locale} />
    </main>
  );
}
