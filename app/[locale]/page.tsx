import Image from "next/image";
import { ArrowRight, Bot, FileHeart, HeartPulse, Languages, Lock, Settings, ShieldCheck, Stethoscope, UserRound } from "lucide-react";
import { setRequestLocale } from "next-intl/server";

import { Link } from "@/lib/i18n/navigation";

export default async function LandingPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  const copy = locale === "ur" ? {
    eyebrow: "آپ کا روزمرہ دل کی صحت کا ساتھی",
    title: "آپ کا دل۔ آپ کی صحت۔ اگلا واضح قدم۔",
    subtitle: "بی پی پاسپورٹ آپ کو اپنی صحت سمجھنے، ریڈنگز محفوظ رکھنے اور اگلا قدم جاننے میں مدد دیتا ہے۔",
    understand: "1۔ سمجھیں",
    understandBody: "ایک مختصر صحت چیک۔",
    guide: "2۔ رہنمائی",
    guideBody: "ایک واضح اگلا قدم۔",
    start: "اپنا صحت چیک شروع کریں",
    ask: "پہلے بی پی پاسپورٹ سے پوچھیں",
    features: [
      { icon: HeartPulse, title: "حقیقی ریڈنگز", body: "آپ کے موجودہ پاسپورٹ میں محفوظ۔" },
      { icon: FileHeart, title: "کیئر رپورٹ", body: "حقیقی 14 دن کا خلاصہ۔" },
      { icon: Lock, title: "اختیار آپ کا", body: "پہلے مقامی، منسلک ہونے پر کلاؤڈ۔" },
    ],
    disclaimer: "بی پی پاسپورٹ تعلیم، ٹریکنگ اور ڈاکٹر کے ساتھ شیئرنگ میں مدد دیتا ہے۔ یہ تشخیص یا علاج تبدیل نہیں کرتا۔ شدید علامات میں ریسکیو 1122 پر کال کریں۔",
  } : {
    eyebrow: "Your everyday heart companion",
    title: "Your heart. Your health. One clear next step.",
    subtitle: "BP Passport helps you understand your health, keep your readings together, and know what comes next.",
    understand: "1. Understand",
    understandBody: "One short health check.",
    guide: "2. Guide",
    guideBody: "One clear next step.",
    start: "Start your health check",
    ask: "Ask BP Passport first",
    features: [
      { icon: HeartPulse, title: "Real readings", body: "Saved to your existing Passport." },
      { icon: FileHeart, title: "Care report", body: "A real 14-day summary." },
      { icon: Lock, title: "You control it", body: "Local first, cloud only when connected." },
    ],
    disclaimer: "BP Passport supports education, tracking, and clinician sharing. It does not diagnose or change treatment. For severe symptoms, call Rescue 1122.",
  };
  const workspaces = locale === "ur" ? [
    { href: "/care" as const, icon: UserRound, title: "مریض", body: "اپنا صحت چیک، ریڈنگز، ادویات اور رپورٹس دیکھیں۔", cta: "میرا ڈیش بورڈ" },
    { href: "/portal" as const, icon: Stethoscope, title: "ڈاکٹر", body: "مریض کی اجازت سے ریکارڈ دیکھیں یا نمونہ ڈیش بورڈ آزمائیں۔", cta: "ڈاکٹر پورٹل" },
    { href: "/admin" as const, icon: Settings, title: "منتظم", body: "صرف مجاز پروگرام عملے کے لیے انتظامی کنسول۔", cta: "ایڈمن کنسول" },
  ] : [
    { href: "/care" as const, icon: UserRound, title: "Patient", body: "Health check, daily readings, medicines, streaks, and reports.", cta: "Open patient care" },
    { href: "/portal" as const, icon: Stethoscope, title: "Clinician", body: "Review patient-authorized records or explore the sample dashboard.", cta: "Open clinician portal" },
    { href: "/admin" as const, icon: Settings, title: "Administrator", body: "A separate, protected operations console for authorized programme staff.", cta: "Open admin console" },
  ];

  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#edf4ef] px-0 sm:px-5 sm:py-5">
      <section className="mx-auto min-h-dvh w-full max-w-[1440px] overflow-hidden bg-white px-5 py-5 sm:min-h-0 sm:rounded-[2rem] sm:px-12 sm:py-8">
        <header className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <span className="inline-flex items-center gap-2 text-xl font-extrabold tracking-tight text-[#078679]">
            <Image src="/heartline-logo.png" width={42} height={42} alt="" priority />
            <span>BP Passport<small className="block text-[9px] font-extrabold tracking-[.2em] text-[#81908b] uppercase">by PharmEvo</small></span>
          </span>
          <div className="flex items-center gap-2">
            <a href="#workspaces" className="hidden text-sm font-bold text-[#55706a] md:inline">{locale === "ur" ? "پورٹلز" : "Workspaces"}</a>
            <Link href="/account" className="hidden text-sm font-bold text-[#55706a] sm:inline">Account</Link>
            <Link href="/" locale={locale === "en" ? "ur" : "en"} className="inline-flex min-h-11 items-center gap-2 rounded-full border-2 border-[#cad9e4] px-3 text-sm font-bold text-[#123d55]"><Languages size={16} />{locale === "en" ? "اردو" : "EN"}</Link>
          </div>
        </header>

        <section className="mx-auto grid max-w-7xl items-center gap-8 pt-12 sm:pt-16 lg:grid-cols-[.85fr_1.15fr] lg:gap-16">
          <div>
            <p className="text-xs font-extrabold tracking-[.16em] text-[#6b817b] uppercase">{copy.eyebrow}</p>
            <h1 className="mt-3 font-serif text-[clamp(2.5rem,5.5vw,5.4rem)] leading-[.96] tracking-[-.055em] text-[#063a3d]">{copy.title}</h1>
            <p className="mt-5 max-w-lg leading-7 text-[#5f7570]">{copy.subtitle}</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-[#d8e8e1] bg-[#f3faf7] p-3 text-xs text-[#5e746f]"><strong className="block text-[#078679]">{copy.understand}</strong>{copy.understandBody}</div>
              <div className="rounded-2xl border border-[#d8e8e1] bg-[#f3faf7] p-3 text-xs text-[#5e746f]"><strong className="block text-[#078679]">{copy.guide}</strong>{copy.guideBody}</div>
            </div>
            <Link href="/care" className="mt-7 flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[#078679] px-6 font-extrabold text-white shadow-[0_12px_25px_rgb(7_134_121/0.2)]">{copy.start} <ArrowRight size={19} className="rtl:rotate-180" /></Link>
            <Link href="/care" className="mt-3 flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[#cce1d8] px-6 font-bold text-[#078679]"><Bot size={18} /> {copy.ask}</Link>
          </div>
          <div className="relative aspect-[4/3] min-h-[24rem] overflow-hidden rounded-[1.8rem] bg-[#f4e8cd]">
            <Image src="/heartline-bp-guidance.png" fill sizes="(max-width: 1024px) 92vw, 680px" className="object-cover" alt="A man calmly checking his blood pressure at home" priority />
          </div>
        </section>

        <section className="mx-auto mt-10 grid max-w-7xl gap-3 sm:grid-cols-3">
          {copy.features.map(({ icon: Icon, title, body }) => <div key={title} className="rounded-2xl border border-[#deebe5] p-4"><Icon size={20} className="text-[#078679]" /><strong className="mt-3 block text-sm text-[#093c3d]">{title}</strong><p className="mt-1 text-xs leading-5 text-[#6b7e79]">{body}</p></div>)}
        </section>

        <section id="workspaces" className="mx-auto mt-12 max-w-7xl scroll-mt-6 rounded-[1.8rem] bg-[#07383a] p-6 text-white sm:p-9">
          <p className="text-xs font-extrabold tracking-[.16em] text-[#8edbd0] uppercase">{locale === "ur" ? "صحیح جگہ منتخب کریں" : "Choose your workspace"}</p>
          <h2 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">{locale === "ur" ? "ہر کردار کا الگ راستہ" : "Patients, clinicians, and staff stay separate."}</h2>
          <div className="mt-6 grid gap-4 lg:grid-cols-3">
            {workspaces.map(({ href, icon: Icon, title, body, cta }) => <article key={title} className="flex flex-col rounded-2xl bg-white p-5 text-[#07383a]"><Icon size={24} className="text-[#078679]" /><h3 className="mt-4 text-lg font-extrabold">{title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-[#5f7570]">{body}</p><Link href={href} className="mt-5 inline-flex min-h-12 items-center justify-between rounded-xl border border-[#cce1d8] px-4 font-bold text-[#078679]">{cta}<ArrowRight size={17} className="rtl:rotate-180" /></Link></article>)}
          </div>
        </section>

        <footer className="mx-auto mt-8 flex max-w-7xl gap-2 border-t border-[#e2ece8] pt-5 text-xs leading-5 text-[#758781]"><ShieldCheck size={16} className="mt-0.5 shrink-0" /><p>{copy.disclaimer}</p></footer>
      </section>
    </main>
  );
}
