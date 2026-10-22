import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { ResultView } from "@/components/result/ResultView";

export const metadata: Metadata = {
  title: "Your result",
  description: "Your private BP Passport screening result and safety-first next step.",
  // Results are personal health data. Never index, never cache in a shared proxy.
  robots: { index: false, follow: false },
};

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-dvh bg-surface-sunken">
      <ResultView />
    </main>
  );
}
