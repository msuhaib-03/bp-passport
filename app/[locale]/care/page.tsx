import { setRequestLocale } from "next-intl/server";

import { HeartLineCare } from "@/components/care/HeartLineCare";

export default async function CarePage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <HeartLineCare />;
}
