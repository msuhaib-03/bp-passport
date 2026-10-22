import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { BpPassportCare } from "@/components/care/HeartLineCare";

export const metadata: Metadata = {
  title: "Patient care",
  description: "Your private BP Passport patient workspace for readings, medicines, reports, reminders, and care sharing.",
  robots: { index: false, follow: false },
};

export default async function CarePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <BpPassportCare />;
}
