import { ArrowLeft, UserRound } from "lucide-react";

import { LogoMark } from "@/components/brand/Logo";
import { Link } from "@/lib/i18n/navigation";

export function MarketingHeader({ locale, back = false }: { locale: string; back?: boolean }) {
  const ur = locale === "ur";
  return (
    <header className="border-b border-[#dce9e4] bg-white/95 backdrop-blur">
      <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 pe-20 sm:px-8 sm:pe-24 lg:px-10">
        <Link href="/" className="inline-flex items-center gap-3 font-extrabold text-[#07383a]" aria-label="BP Passport home">
          {back ? <ArrowLeft size={20} className="rtl:rotate-180" aria-hidden /> : <LogoMark size={38} decorative />}
          <span>{back ? (ur ? "ہوم پر واپس" : "Back home") : "BP Passport"}</span>
        </Link>
        <Link href="/account" className="hidden min-h-11 items-center gap-2 rounded-full border border-[#c6ddd7] px-4 text-sm font-bold text-[#176b63] sm:inline-flex">
          <UserRound size={17} aria-hidden /> {ur ? "اکاؤنٹ" : "Account"}
        </Link>
      </div>
    </header>
  );
}
