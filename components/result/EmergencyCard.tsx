"use client";

import { useTranslations } from "next-intl";
import { AlertTriangle, PhoneCall } from "lucide-react";

import { EMERGENCY_CONTACTS } from "@/lib/clinical/triage";

/**
 * Hypertensive-crisis interrupt.
 *
 * This is the only component permitted to use saturated red, and the only one
 * permitted to interrupt the flow. Reserving both for genuine emergencies is
 * what keeps them meaningful — an app that shouts at a Grade 1 reading trains
 * users to dismiss the shout that matters.
 *
 * The phone numbers are `tel:` links, tappable directly. Someone with a systolic
 * of 190 should not have to copy a number between apps.
 */
export function EmergencyCard() {
  const t = useTranslations("emergency");

  return (
    <section
      role="alert"
      aria-live="assertive"
      className="urgent-pulse rounded-2xl border-2 p-5"
      style={{
        background: "var(--color-risk-crisis-soft)",
        borderColor: "var(--color-risk-crisis)",
      }}
    >
      <div className="flex items-start gap-3">
        <AlertTriangle
          size={26}
          aria-hidden
          className="mt-0.5 shrink-0"
          style={{ color: "var(--color-risk-crisis)" }}
        />
        <div className="min-w-0">
          <h2
            className="text-xl font-bold"
            style={{ color: "var(--color-risk-crisis-ink)" }}
          >
            {t("title")}
          </h2>
          <p
            className="mt-2 text-base leading-relaxed"
            style={{ color: "var(--color-risk-crisis-ink)" }}
          >
            {t("readingBody")}
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3">
        <a
          href={`tel:${EMERGENCY_CONTACTS.nicvd.replace(/-/g, "")}`}
          className="flex min-h-[3.75rem] w-full items-center justify-center gap-2.5 rounded-xl px-5 text-lg font-bold text-white"
          style={{ background: "var(--color-risk-crisis)" }}
        >
          <PhoneCall size={20} aria-hidden />
          {t("callNicvd", { number: EMERGENCY_CONTACTS.nicvd })}
        </a>
        <a
          href={`tel:${EMERGENCY_CONTACTS.rescue}`}
          className="flex min-h-[3.5rem] w-full items-center justify-center gap-2.5 rounded-xl border-2 bg-white px-5 text-base font-bold"
          style={{
            borderColor: "var(--color-risk-crisis)",
            color: "var(--color-risk-crisis-ink)",
          }}
        >
          <PhoneCall size={18} aria-hidden />
          {t("callRescue", { number: EMERGENCY_CONTACTS.rescue })}
        </a>
      </div>

      <p
        className="mt-4 text-center text-sm font-semibold"
        style={{ color: "var(--color-risk-crisis-ink)" }}
      >
        {t("goNow")}
      </p>
    </section>
  );
}
