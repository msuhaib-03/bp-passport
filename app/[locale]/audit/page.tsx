import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";

import { AuditFlow } from "@/components/audit/AuditFlow";

export const metadata: Metadata = {
  title: "60-second health check",
  description: "Answer a short, bilingual blood-pressure health check and receive a clear, safety-first next step.",
};

export default async function AuditPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ c?: string }>;
}) {
  const [{ locale }, { c }] = await Promise.all([params, searchParams]);
  setRequestLocale(locale);

  // `?c=lums-spring` on a printed QR code attributes the scan to a campaign.
  // Sanitised here rather than trusted: it is user-controllable input that ends
  // up in storage and, later, in analytics.
  const campaign = c?.replace(/[^a-z0-9-]/gi, "").slice(0, 32) || undefined;

  return (
    <main className="bg-white">
      <AuditFlow campaign={campaign} />
    </main>
  );
}
