import { Clock, HeartPulse, Lock, ShieldCheck, Stethoscope } from "lucide-react";
import { getTranslations, setRequestLocale } from "next-intl/server";

import { LogoLockup } from "@/components/brand/Logo";
import { LocaleSwitch } from "@/components/ui/LocaleSwitch";
import { Link } from "@/lib/i18n/navigation";

/**
 * Campaign landing (SCR-01) — the screen a QR code opens.
 *
 * DESIGN INTENT
 * -------------
 * The single job here is to get a sceptical person from "what is this" to
 * "started" in under six seconds, standing in a pharmacy queue. So:
 *
 *  · The value proposition is a time promise, not a feature list. "60 seconds"
 *    is the only claim that overcomes the friction of starting.
 *  · The three reassurances answer the three unspoken objections in order:
 *    how long, who sees this, do I need equipment. The third matters most —
 *    most people scanning a poster do not have a cuff, and if they think they
 *    need one they leave.
 *  · The CTA is above the epidemiology. Statistics justify the product to a
 *    funder; they do not motivate a 29-year-old, and putting them first pushes
 *    the button below the fold.
 *  · "This is not a diagnosis" appears on the first screen, not buried in a
 *    footer. It is a DRAP Class A requirement and it also builds trust.
 */
export default async function LandingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("landing");
  const tb = await getTranslations("brand");

  const reassurances = [
    { icon: Clock, text: t("reassure.time") },
    { icon: Lock, text: t("reassure.private") },
    { icon: Stethoscope, text: t("reassure.noCuff") },
  ];

  const stats = [
    { value: t("why.stat1Value"), label: t("why.stat1Label") },
    { value: t("why.stat2Value"), label: t("why.stat2Label") },
    { value: t("why.stat3Value"), label: t("why.stat3Label") },
  ];

  return (
    <main className="min-h-dvh bg-white">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <header className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-5 pt-5">
        <LogoLockup size={38} />
        <LocaleSwitch />
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-3xl px-5 pt-10 pb-8">
        <p className="inline-flex items-center gap-2 rounded-full bg-cyan-100 px-4 py-2 text-sm font-bold text-cyan-600">
          <HeartPulse size={16} aria-hidden />
          {t("eyebrow")}
          <span className="text-cyan-600/60">·</span>
          {tb("free")}
        </p>

        <h1 className="mt-6 text-4xl leading-[1.12] font-bold text-ink-900 sm:text-5xl">
          {t("title")}
        </h1>

        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-600">
          {t("subtitle")}
        </p>

        {/* Primary action sits above everything explanatory. */}
        <Link
          href="/audit"
          className="brand-gradient mt-8 inline-flex min-h-[4rem] w-full items-center justify-center rounded-2xl px-8 text-lg font-bold text-white shadow-[0_4px_20px_rgb(34_195_214/0.35)] transition-transform active:scale-[0.99] sm:w-auto"
        >
          {t("cta")}
        </Link>

        <ul className="mt-7 grid gap-3 sm:grid-cols-3">
          {reassurances.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2.5 text-sm text-ink-600">
              <Icon size={18} className="mt-0.5 shrink-0 text-cyan-500" aria-hidden />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* ── Why it matters ─────────────────────────────────────────────── */}
      <section className="border-t border-border bg-surface-sunken px-5 py-10">
        <div className="mx-auto max-w-3xl">
          <h2 className="text-xl font-bold text-ink-900">{t("why.title")}</h2>
          <dl className="mt-5 grid gap-4 sm:grid-cols-3">
            {stats.map(({ value, label }) => (
              <div key={label} className="card p-5">
                <dt className="sr-only">{label}</dt>
                <dd>
                  <span className="block text-2xl leading-tight font-bold text-ink-900">
                    {value}
                  </span>
                  <span className="mt-2 block text-sm leading-snug text-ink-600">
                    {label}
                  </span>
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* ── Regulatory posture, stated plainly and early ───────────────── */}
      <section className="px-5 py-10">
        <div className="mx-auto flex max-w-3xl gap-3.5 rounded-2xl border border-border bg-surface-sunken p-5">
          <ShieldCheck size={22} className="mt-0.5 shrink-0 text-ink-500" aria-hidden />
          <div>
            <p className="font-bold text-ink-900">{t("disclaimerTitle")}</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
              {t("disclaimer")}
            </p>
          </div>
        </div>
      </section>

      <footer className="px-5 pb-10 text-center">
        <p className="text-sm text-ink-400">{tb("tagline")}</p>
      </footer>
    </main>
  );
}
