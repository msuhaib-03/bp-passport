import { MarketingHeader } from "@/components/marketing/MarketingHeader";
import { SiteFooter } from "@/components/marketing/SiteFooter";

export type LegalSection = { heading: string; paragraphs: string[]; bullets?: string[] };

export function LegalPage({ locale, eyebrow, title, intro, sections }: {
  locale: string;
  eyebrow: string;
  title: string;
  intro: string;
  sections: LegalSection[];
}) {
  return (
    <main className="min-h-dvh bg-[#f2f7f4]">
      <MarketingHeader locale={locale} back />
      <article className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-xs font-extrabold tracking-[.16em] text-[#078679] uppercase">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-tight text-[#07383a] sm:text-5xl">{title}</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-[#55706a]">{intro}</p>
        <p className="mt-4 text-xs font-semibold text-[#7a8d88]">Effective 22 October 2026 · Last updated 22 October 2026</p>
        <div className="mt-10 space-y-5">
          {sections.map((section) => (
            <section key={section.heading} className="rounded-2xl border border-[#d8e7e2] bg-white p-5 sm:p-7">
              <h2 className="text-xl font-extrabold text-[#07383a]">{section.heading}</h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-[#4e6862] sm:text-base">
                {section.paragraphs.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                {section.bullets && <ul className="list-disc space-y-2 ps-5">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
              </div>
            </section>
          ))}
        </div>
      </article>
      <SiteFooter locale={locale} />
    </main>
  );
}
