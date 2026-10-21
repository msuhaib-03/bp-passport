import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { ClinicianReview } from "@/components/admin/ClinicianReview";
import { Link } from "@/lib/i18n/navigation";

export const metadata: Metadata = {
  title: "Programme administration",
  robots: { index: false, follow: false },
};

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return (
    <main className="min-h-dvh bg-surface-sunken px-5 py-8">
      <div className="mx-auto max-w-4xl">
        <nav className="flex flex-wrap items-center justify-between gap-3"><Link href="/" className="text-sm font-semibold text-cyan-600">← BP Passport home</Link><Link href="/portal" className="text-sm font-semibold text-ink-600">Clinician portal</Link></nav>
        <div className="mt-8"><ClinicianReview /></div>
      </div>
    </main>
  );
}
