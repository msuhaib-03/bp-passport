"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Flame, Plus } from "lucide-react";

import { BpEntry } from "@/components/audit/BpEntry";
import { Button } from "@/components/ui/Button";
import { LogoMark } from "@/components/brand/Logo";
import { Link } from "@/lib/i18n/navigation";
import {
  appendReading,
  createPassport,
  currentStreak,
  readDraft,
  readPassport,
  type Passport,
} from "@/lib/storage";
import { syncNewPassport, syncReading } from "@/lib/supabase/persistence";
import { summariseSeries, type BpReading } from "@/lib/clinical/bp-classification";
import { CATEGORY_VISUAL } from "@/lib/clinical/presentation";
import type { LifestyleAnswers } from "@/lib/clinical/heart-score";

/**
 * BP Passport dashboard (SCR-05) — the returning-user surface.
 *
 * RETENTION DESIGN
 * ----------------
 * The longitudinal thesis lives or dies on repeat logging, and 60–80% of users
 * of self-monitoring tools disengage inside 30 days. Three choices target that:
 *
 *  · The Passport ID is displayed prominently and reads aloud cleanly (PE-XXXX,
 *    with no I/O/0/1). It makes the record feel like a possession rather than a
 *    form submission — and possessions get returned to.
 *  · Logging is one screen and one action, reachable from the top of the page.
 *    Anything more and the daily habit does not form.
 *  · The streak has a 48-hour grace window. Strict streaks punish one missed day
 *    and cause the user to quit entirely; a forgiving streak survives real life.
 *
 * The 14-day mean ± SD is shown because that is the figure a GP can act on. A
 * single latest reading is what paper diaries already provide, and it is exactly
 * why clinicians ignore them.
 */
export function PassportView() {
  const t = useTranslations("result");
  const tc = useTranslations("common");

  const [passport, setPassport] = useState<Passport | null>(null);
  const [logging, setLogging] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const existing = readPassport();
    if (existing) {
      setPassport(existing);
      setReady(true);
      return;
    }
    // First visit after finishing the audit: mint the Passport from the draft.
    const draft = readDraft();
    const answers = draft?.answers as LifestyleAnswers | undefined;
    if (answers) {
      const created = createPassport({
        answers,
        reading: draft?.reading ?? null,
        campaign: draft?.campaign,
      });
      setPassport(created);
      void syncNewPassport(created).catch(() => {
        // Local storage remains the offline fallback; cloud sync can retry on a later flow.
      });
    }
    setReady(true);
  }, []);

  const handleLog = (reading: BpReading | null) => {
    setLogging(false);
    if (!reading) return;
    const updated = appendReading({ ...reading, at: new Date().toISOString() });
    if (updated) {
      setPassport(updated);
      void syncReading(updated.readings[updated.readings.length - 1]!).catch(() => {
        // Keep the local reading when the network or Supabase is unavailable.
      });
    }
  };

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <p className="text-ink-400">…</p>
      </div>
    );
  }

  if (!passport) {
    return (
      <div className="mx-auto max-w-xl px-5 py-16 text-center">
        <LogoMark size={56} className="mx-auto" decorative />
        <p className="mt-6 text-lg text-ink-600">{t("nextBody")}</p>
        <Link
          href="/audit"
          className="brand-gradient mt-6 inline-flex min-h-[3.5rem] items-center justify-center rounded-xl px-7 font-bold text-white"
        >
          {tc("start")}
        </Link>
      </div>
    );
  }

  const streak = currentStreak(passport.readings);
  const recent = passport.readings.slice(-14);
  const summary = summariseSeries(recent);

  return (
    <div className="mx-auto max-w-xl px-5 pt-6 pb-12">
      {/* ── Passport card ─────────────────────────────────────────────── */}
      <section className="rounded-2xl bg-ink-900 p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold tracking-[0.12em] text-cyan-300 uppercase">
              BP Passport
            </p>
            <p className="numeric mt-1.5 text-2xl font-bold">{passport.id}</p>
          </div>
          <LogoMark size={44} decorative />
        </div>

        <div className="mt-6 flex items-center gap-5">
          <div>
            <p className="numeric text-3xl font-bold">{passport.readings.length}</p>
            <p className="mt-0.5 text-xs text-ink-300">readings</p>
          </div>
          {streak > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
              <Flame size={18} className="text-[var(--color-coral-500)]" aria-hidden />
              <span className="numeric text-lg font-bold">{streak}</span>
              <span className="text-sm text-ink-200">day streak</span>
            </div>
          )}
        </div>
      </section>

      {/* ── Log action, kept at the top where the habit forms ─────────── */}
      {!logging && (
        <Button
          size="lg"
          fullWidth
          className="mt-5"
          onClick={() => setLogging(true)}
        >
          <Plus size={20} aria-hidden />
          Log today&apos;s reading
        </Button>
      )}

      {logging && (
        <section className="card mt-5 p-6">
          <h2 className="text-lg font-bold text-ink-900">Today&apos;s reading</h2>
          <div className="mt-5">
            <BpEntry onSubmit={handleLog} />
          </div>
        </section>
      )}

      {/* ── The figure a clinician can act on ─────────────────────────── */}
      {summary && summary.count >= 2 && (
        <section className="card mt-5 p-6">
          <p className="text-sm font-bold text-ink-500">
            Your average over the last {summary.count} readings
          </p>
          <p className="numeric mt-2 text-4xl font-bold text-ink-900">
            {summary.meanSystolic}/{summary.meanDiastolic}
          </p>
          <p className="numeric mt-1 text-sm text-ink-400">
            ± {summary.sdSystolic}/{summary.sdDiastolic} mmHg
          </p>

          <div
            className="mt-4 inline-flex rounded-full px-4 py-2 text-sm font-bold"
            style={{
              background: CATEGORY_VISUAL[summary.category].surface,
              color: CATEGORY_VISUAL[summary.category].onSurface,
            }}
          >
            {t(`category.${summary.category}`)}
          </div>

          {summary.systolicTrend !== 0 && (
            <p className="mt-4 text-base text-ink-700">
              {summary.systolicTrend < 0
                ? `Down ${Math.abs(summary.systolicTrend)} mmHg since you started. Keep going.`
                : `Up ${summary.systolicTrend} mmHg. Worth showing a doctor.`}
            </p>
          )}
        </section>
      )}

      {passport.readings.length === 1 && (
        <p className="mt-5 text-center text-base text-ink-500">
          Log again tomorrow. Two weeks of readings is what a doctor needs to act.
        </p>
      )}
    </div>
  );
}
