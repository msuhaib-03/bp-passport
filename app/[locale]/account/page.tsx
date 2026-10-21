import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { AccountPanel } from "@/components/auth/AccountPanel";
import { Link } from "@/lib/i18n/navigation";

export const metadata: Metadata = {
  title: "My account",
  robots: { index: false, follow: false },
};

export default async function AccountPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ next?: string }>;
}) {
  const { locale } = await params;
  const query = await searchParams;
  const destination = query.next === "portal" ? "portal" : "care";
  setRequestLocale(locale);

  return (
    <main className="min-h-dvh bg-surface-sunken px-5 py-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-sm font-semibold text-cyan-600">BP Passport</Link>
        <p className="mt-8 text-xs font-extrabold tracking-[.14em] text-cyan-700 uppercase">{destination === "portal" ? "Clinician workspace" : "Patient workspace"}</p>
        <h1 className="mt-2 text-3xl font-bold text-ink-900">{destination === "portal" ? "Clinician sign in" : "Your patient account"}</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-600">
          {destination === "portal" ? "Sign in to review records that patients have explicitly shared with your clinician profile." : "Sign in to keep your passport and readings available when you change phones or browsers."}
        </p>
        <div className="mt-8">
          <AccountPanel locale={locale} destination={destination} />
        </div>
        <Link href={destination === "portal" ? "/portal" : "/care"} className="mt-6 inline-block text-sm font-semibold text-cyan-600">
          {destination === "portal" ? "Back to clinician portal" : "Back to patient dashboard"}
        </Link>
      </div>
    </main>
  );
}
