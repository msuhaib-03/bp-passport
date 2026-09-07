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
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  return (
    <main className="min-h-dvh bg-surface-sunken px-5 py-8">
      <div className="mx-auto max-w-xl">
        <Link href="/" className="text-sm font-semibold text-cyan-600">BP Passport</Link>
        <h1 className="mt-8 text-3xl font-bold text-ink-900">Your account</h1>
        <p className="mt-3 text-base leading-relaxed text-ink-600">
          Sign in to keep your passport and readings available when you change phones or browsers.
        </p>
        <div className="mt-8">
          <AccountPanel />
        </div>
        <Link href="/passport" className="mt-6 inline-block text-sm font-semibold text-cyan-600">
          Back to my passport
        </Link>
      </div>
    </main>
  );
}
