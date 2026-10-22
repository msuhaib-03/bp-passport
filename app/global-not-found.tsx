import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Compass, Linkedin } from "lucide-react";

import { LogoMark } from "@/components/brand/Logo";
import { PUBLIC_LOCATION, SITE_ORIGIN, TEAM } from "@/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_ORIGIN),
  title: "Page not found · BP Passport",
  description: "The requested BP Passport page could not be found.",
  robots: { index: false, follow: false },
};

export default function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body>
        <main className="min-h-dvh bg-[#f2f7f4]">
          <header className="border-b border-[#dce9e4] bg-white">
            <div className="mx-auto flex min-h-20 max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
              <Link href="/en" className="inline-flex items-center gap-3 font-extrabold text-[#07383a]">
                <LogoMark size={38} decorative /> BP Passport
              </Link>
              <div className="flex gap-2 text-sm font-bold">
                <Link href="/en" className="rounded-full border border-[#c6ddd7] px-4 py-2 text-[#176b63]">EN</Link>
                <Link href="/ur" lang="ur" className="rounded-full border border-[#c6ddd7] px-4 py-2 text-[#176b63]">اردو</Link>
              </div>
            </div>
          </header>

          <section className="mx-auto flex min-h-[68vh] max-w-4xl items-center px-5 py-16 text-center sm:px-8">
            <div className="w-full">
              <span className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-[#dff3ee] text-[#078679]"><Compass size={38} aria-hidden /></span>
              <p className="mt-7 text-sm font-extrabold tracking-[.18em] text-[#078679] uppercase">404</p>
              <h1 className="mt-3 font-serif text-4xl text-[#07383a] sm:text-6xl">This page took a wrong turn.</h1>
              <p className="mx-auto mt-5 max-w-xl leading-7 text-[#55706a]">The link may be out of date or the address may be mistyped. Return home or start a fresh health check.</p>
              <p lang="ur" dir="rtl" className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[#6b817b]">یہ صفحہ نہیں ملا۔ ہوم پر واپس جائیں یا نیا صحت چیک شروع کریں۔</p>
              <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                <Link href="/en" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-xl bg-[#078679] px-6 font-extrabold text-white">Go home <ArrowRight size={18} aria-hidden /></Link>
                <Link href="/en/audit" className="inline-flex min-h-14 items-center justify-center rounded-xl border border-[#b9d6cf] bg-white px-6 font-bold text-[#176b63]">Start health check</Link>
              </div>
            </div>
          </section>

          <footer className="border-t border-white/10 bg-[#062f31] text-[#c5ddda]">
            <div className="mx-auto flex max-w-7xl flex-col gap-5 px-5 py-8 text-sm sm:px-8 md:flex-row md:items-center md:justify-between lg:px-10">
              <div><p className="font-extrabold text-white">BP Passport</p><p className="mt-1 text-xs">{PUBLIC_LOCATION}</p></div>
              <div className="flex flex-wrap gap-4">
                {TEAM.map((member) => <a key={member.linkedin} href={member.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold hover:text-white"><Linkedin size={14} aria-hidden />{member.name}</a>)}
              </div>
              <div className="flex gap-4 font-semibold"><Link href="/en/privacy">Privacy</Link><Link href="/en/terms">Terms</Link><Link href="/en/contact">Contact</Link></div>
            </div>
          </footer>
        </main>
      </body>
    </html>
  );
}
