import { ExternalLink, Linkedin, MapPin, ShieldCheck } from "lucide-react";

import { LogoMark } from "@/components/brand/Logo";
import { Link } from "@/lib/i18n/navigation";
import { PUBLIC_LOCATION, TEAM } from "@/lib/site";

export function SiteFooter({ locale }: { locale: string }) {
  const ur = locale === "ur";
  const copy = ur
    ? {
        summary: "بلڈ پریشر کو سمجھنے، محفوظ کرنے اور اپنی مرضی سے ڈاکٹر کے ساتھ شیئر کرنے کا ایک آسان طریقہ۔",
        product: "پروڈکٹ",
        start: "صحت چیک شروع کریں",
        patient: "مریض کی جگہ",
        clinician: "ڈاکٹر پورٹل",
        company: "کمپنی",
        contact: "رابطہ",
        team: "ہماری ٹیم",
        legal: "قانونی",
        privacy: "رازداری کی پالیسی",
        terms: "شرائطِ استعمال",
        location: "پروڈکٹ ٹیم کا مقام",
        disclaimer: "تعلیمی اور ٹریکنگ ٹول — طبی تشخیص یا ہنگامی سروس نہیں۔",
        rights: "تمام حقوق محفوظ ہیں۔",
        portfolio: "پورٹ فولیو",
      }
    : {
        summary: "A simple way to understand blood pressure, keep readings together, and share them with a clinician on your terms.",
        product: "Product",
        start: "Start a health check",
        patient: "Patient workspace",
        clinician: "Clinician portal",
        company: "Company",
        contact: "Contact",
        team: "Meet the team",
        legal: "Legal",
        privacy: "Privacy policy",
        terms: "Terms of service",
        location: "Product team location",
        disclaimer: "An education and tracking tool — not a diagnosis or emergency service.",
        rights: "All rights reserved.",
        portfolio: "Portfolio",
      };

  return (
    <footer className="border-t border-[#dce9e4] bg-[#062f31] text-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 sm:px-8 lg:grid-cols-[1.35fr_.7fr_.7fr_1.35fr] lg:px-10">
        <div>
          <Link href="/" className="inline-flex items-center gap-3" aria-label="BP Passport home">
            <LogoMark size={44} decorative />
            <span className="text-xl font-extrabold tracking-tight">BP Passport</span>
          </Link>
          <p className="mt-4 max-w-sm text-sm leading-6 text-[#c5ddda]">{copy.summary}</p>
          <address className="mt-4 inline-flex items-start gap-2 text-sm not-italic text-[#c5ddda]">
            <MapPin size={17} className="mt-0.5 shrink-0 text-[#75d7ca]" aria-hidden />
            <span><span className="block text-xs text-[#8fb6b1]">{copy.location}</span>{PUBLIC_LOCATION}</span>
          </address>
        </div>

        <FooterLinks title={copy.product} links={[
          { href: "/audit", label: copy.start },
          { href: "/care", label: copy.patient },
          { href: "/portal", label: copy.clinician },
        ]} />
        <FooterLinks title={copy.company} links={[
          { href: "/contact", label: copy.contact },
          { href: "/contact#team", label: copy.team },
          { href: "/account", label: ur ? "اکاؤنٹ" : "Account" },
        ]} />
        <div>
          <h2 className="text-sm font-extrabold tracking-[.12em] text-[#8fded4] uppercase">{copy.team}</h2>
          <div className="mt-4 space-y-4">
            {TEAM.map((member) => (
              <div key={member.linkedin} className="rounded-xl border border-white/10 bg-white/5 p-3">
                <p className="font-bold">{member.name}</p>
                <p className="text-xs text-[#a9c9c5]">{member.role}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-xs font-semibold text-[#8fded4]">
                  <a href={member.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">
                    <Linkedin size={14} aria-hidden /> LinkedIn <ExternalLink size={11} aria-hidden />
                  </a>
                  <a href={member.portfolio} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-white">
                    {copy.portfolio} <ExternalLink size={11} aria-hidden />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-6 text-xs text-[#a9c9c5] sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
          <p className="flex gap-2"><ShieldCheck size={15} className="mt-0.5 shrink-0" aria-hidden />{copy.disclaimer}</p>
          <nav aria-label={copy.legal} className="flex flex-wrap gap-x-5 gap-y-2 font-semibold">
            <Link href="/privacy" className="hover:text-white">{copy.privacy}</Link>
            <Link href="/terms" className="hover:text-white">{copy.terms}</Link>
            <Link href="/contact" className="hover:text-white">{copy.contact}</Link>
          </nav>
          <p className="whitespace-nowrap">© {new Date().getFullYear()} BP Passport. {copy.rights}</p>
        </div>
      </div>
    </footer>
  );
}

function FooterLinks({ title, links }: { title: string; links: { href: string; label: string }[] }) {
  return (
    <nav aria-label={title}>
      <h2 className="text-sm font-extrabold tracking-[.12em] text-[#8fded4] uppercase">{title}</h2>
      <ul className="mt-4 space-y-3 text-sm text-[#c5ddda]">
        {links.map((link) => <li key={link.href}><Link href={link.href} className="hover:text-white">{link.label}</Link></li>)}
      </ul>
    </nav>
  );
}
