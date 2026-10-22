import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { ClinicianPortal } from "@/components/clinician/ClinicianPortal";
import { Link } from "@/lib/i18n/navigation";

export const metadata: Metadata = { title: "Clinician portal", description: "Clinician workspace for reviewing time-limited patient-authorized BP Passport records.", robots: { index: false, follow: false } };

export default async function PortalPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <main className="min-h-dvh bg-surface-sunken px-5 py-8"><div className="mx-auto max-w-7xl"><nav className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="text-sm font-semibold text-cyan-600">← BP Passport home</Link><Link href="/account?next=portal" className="text-sm font-semibold text-ink-600">Clinician sign in</Link></nav><div className="mt-8"><ClinicianPortal /></div></div></main>;
}
