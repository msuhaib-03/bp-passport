"use client";

import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowRight, RotateCcw, ShieldCheck } from "lucide-react";

import { EmergencyCard } from "./EmergencyCard";
import { RiskScale } from "./RiskScale";
import { Button } from "@/components/ui/Button";
import { Link, useRouter } from "@/lib/i18n/navigation";
import { readDraft } from "@/lib/storage";
import {
  calculateHeartScore,
  projectedScore,
  type HeartScoreResult,
  type LifestyleAnswers,
} from "@/lib/clinical/heart-score";
import { BAND_ACCENT, CATEGORY_VISUAL } from "@/lib/clinical/presentation";

/**
 * Results screen (SCR-03).
 *
 * NARRATIVE ORDER — chosen deliberately, and it is not the obvious one:
 *   1. Emergency card, if and only if the reading is a crisis. Nothing else
 *      matters until that is dealt with.
 *   2. The reading and what range it falls in. Concrete before abstract: users
 *      came for their blood pressure, not for a proprietary score.
 *   3. The Heart Score, explicitly framed as lifestyle and explicitly not a
 *      diagnosis.
 *   4. "Start with this" — the two or three habits costing the most points,
 *      with a concrete, culturally specific action for each.
 *
 * Step 4 is the one that changes behaviour. A score with no lever attached is
 * just a grade, and grades do not move people. Showing "fixing salt and walking
 * takes you from 54 to 78" converts a number into a decision.
 */
export function ResultView() {
  const t = useTranslations("result");
  const router = useRouter();
  const [state, setState] = useState<
    { status: "loading" } | { status: "empty" } | { status: "ready"; result: HeartScoreResult }
  >({ status: "loading" });

  useEffect(() => {
    const draft = readDraft();
    const answers = draft?.answers as LifestyleAnswers | undefined;
    const complete =
      answers &&
      (["sleep", "sodium", "stress", "stimulants", "activity"] as const).every(
        (k) => answers[k],
      );

    if (!draft || !complete) {
      setState({ status: "empty" });
      return;
    }
    setState({
      status: "ready",
      result: calculateHeartScore(answers, draft.reading ?? null),
    });
  }, []);

  // Deep-linking here without completing the audit is a dead end, so send the
  // user back to the start rather than showing an empty shell.
  useEffect(() => {
    if (state.status === "empty") router.replace("/audit");
  }, [state.status, router]);

  if (state.status !== "ready") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5">
        <p className="text-ink-400">…</p>
      </div>
    );
  }

  const { result } = state;
  const { bp } = result;
  const projected = projectedScore(result, 2);

  return (
    <div className="mx-auto max-w-xl px-5 pt-6 pb-12">
      <p className="text-sm font-bold text-ink-500">{t("eyebrow")}</p>

      {bp?.isCrisis && (
        <div className="mt-4">
          <EmergencyCard />
        </div>
      )}

      {/* ── The reading ───────────────────────────────────────────────── */}
      {bp && (
        <section className="card mt-5 p-6">
          <p className="text-sm font-bold text-ink-500">{t("readingTitle")}</p>
          <p className="numeric mt-2 text-5xl font-bold text-ink-900">
            {bp.systolic}/{bp.diastolic}
            <span className="ms-2 align-middle text-base font-medium text-ink-400">
              mmHg
            </span>
          </p>

          <div
            className="mt-4 inline-flex items-center rounded-full px-4 py-2 text-sm font-bold"
            style={{
              background: CATEGORY_VISUAL[bp.category].surface,
              color: CATEGORY_VISUAL[bp.category].onSurface,
            }}
          >
            {t(`category.${bp.category}`)}
          </div>

          <div className="mt-6">
            <RiskScale systolic={bp.systolic} category={bp.category} />
          </div>

          <p className="mt-6 text-base leading-relaxed text-ink-700">
            {t(`categoryExplain.${bp.category}`)}
          </p>
        </section>
      )}

      {/* ── Heart Score ───────────────────────────────────────────────── */}
      <section className="card mt-5 p-6">
        <p className="text-sm font-bold text-ink-500">{t("scoreTitle")}</p>

        <div className="mt-3 flex items-end gap-3">
          <span
            className="numeric text-6xl leading-none font-bold"
            style={{ color: BAND_ACCENT[result.band] }}
          >
            {result.score}
          </span>
          <span className="pb-2 text-base text-ink-400">{t("scoreOutOf")}</span>
        </div>

        <div
          className="mt-4 inline-flex rounded-full px-4 py-2 text-sm font-bold text-white"
          style={{ background: BAND_ACCENT[result.band] }}
        >
          {t(`band.${result.band}`)}
        </div>

        {/* Gauge doubles the number visually for users who read figures slowly. */}
        <div
          className="mt-5 h-3 w-full overflow-hidden rounded-full bg-ink-100"
          role="img"
          aria-label={`${result.score} / 100`}
        >
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{
              width: `${result.score}%`,
              background: BAND_ACCENT[result.band],
            }}
          />
        </div>

        <p className="mt-4 text-sm leading-relaxed text-ink-500">
          {t("scoreExplainer")}
        </p>
      </section>

      {/* ── The levers: the part that changes behaviour ───────────────── */}
      {result.topLevers.length > 0 && (
        <section className="mt-5">
          <h2 className="text-xl font-bold text-ink-900">{t("leversTitle")}</h2>
          <p className="mt-1.5 text-base text-ink-600">
            {t("leversSubtitle", { projected })}
          </p>

          <ul className="mt-4 space-y-3">
            {result.topLevers.map((lever) => (
              <li key={lever.factor} className="card p-5">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-lg font-bold text-ink-900">
                    {t(`factor.${lever.factor}`)}
                  </h3>
                  <span className="numeric shrink-0 rounded-full bg-cyan-100 px-3 py-1 text-sm font-bold text-cyan-600">
                    {t("leverGain", { points: lever.headroom })}
                  </span>
                </div>
                <p className="mt-2 text-base leading-relaxed text-ink-700">
                  {t(`tip.${lever.factor}`)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Next step ─────────────────────────────────────────────────── */}
      <section className="brand-gradient mt-6 rounded-2xl p-6 text-white">
        <h2 className="text-xl font-bold">{t("nextTitle")}</h2>
        <p className="mt-2 text-base leading-relaxed text-white/90">{t("nextBody")}</p>
        <Link
          href="/passport"
          className="mt-5 inline-flex min-h-[3.5rem] w-full items-center justify-center gap-2 rounded-xl bg-white px-6 text-lg font-bold text-ink-900"
        >
          {t("nextCta")}
          <ArrowRight size={20} aria-hidden className="rtl:rotate-180" />
        </Link>
      </section>

      <div className="mt-5">
        <Button
          variant="ghost"
          fullWidth
          onClick={() => router.push("/audit")}
        >
          <RotateCcw size={18} aria-hidden />
          {t("retake")}
        </Button>
      </div>

      <p className="mt-8 flex gap-2.5 text-xs leading-relaxed text-ink-400">
        <ShieldCheck size={16} aria-hidden className="mt-0.5 shrink-0" />
        {t("disclaimer")}
      </p>
    </div>
  );
}
