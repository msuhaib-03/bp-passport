"use client";

import { LocaleSwitch } from "./LocaleSwitch";
import { usePathname } from "@/lib/i18n/navigation";

export function GlobalLocaleSwitch() {
  const pathname = usePathname();
  if (pathname === "/" || pathname === "/care") return null;
  return <div className="fixed end-3 top-3 z-50 print:hidden"><LocaleSwitch className="bg-white/95 shadow-lg backdrop-blur" /></div>;
}
