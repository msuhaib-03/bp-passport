import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { PatientRecord } from "@/components/clinician/PatientRecord";

export const metadata: Metadata = { title: "Shared patient record", robots: { index: false, follow: false } };

export default async function SharedPatientPage({ params }: { params: Promise<{ locale: string; reference: string }> }) {
  const { locale, reference } = await params;
  setRequestLocale(locale);
  return <main className="min-h-dvh bg-surface-sunken px-5 py-8"><div className="mx-auto max-w-3xl"><PatientRecord reference={reference} locale={locale} /></div></main>;
}
