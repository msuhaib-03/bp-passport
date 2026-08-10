import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { PassportView } from "@/components/passport/PassportView";

export const metadata: Metadata = {
  title: "My Passport",
  robots: { index: false, follow: false },
};

export default async function PassportPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-dvh bg-surface-sunken">
      <PassportView />
    </main>
  );
}
