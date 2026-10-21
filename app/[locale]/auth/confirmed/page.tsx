import { setRequestLocale } from "next-intl/server";

import { ConfirmationLanding } from "@/components/auth/ConfirmationLanding";
import { Link } from "@/lib/i18n/navigation";

export default async function ConfirmedPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ next?: string }> }) {
  const { locale } = await params;
  const query = await searchParams;
  const destination = query.next === "portal" ? "portal" : "care";
  setRequestLocale(locale);
  return <main className="min-h-dvh bg-surface-sunken px-5 py-10"><div className="mx-auto max-w-xl"><Link href="/" className="text-sm font-semibold text-cyan-600">← BP Passport home</Link><div className="mt-8"><ConfirmationLanding destination={destination} /></div></div></main>;
}
