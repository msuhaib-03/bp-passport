"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Check } from "lucide-react";

import { BpEntry } from "./BpEntry";
import { useRouter } from "@/lib/i18n/navigation";
import { readDraft, writeDraft } from "@/lib/storage";
import { LEVELS, type Level, type LifestyleAnswers } from "@/lib/clinical/heart-score";
import type { BpReading } from "@/lib/clinical/bp-classification";

/**
 * The seven-step Heart Audit (SCR-02).
 *
 * FLOW DECISIONS
 * --------------
 *  · One question per screen. Users on a kiosk have a queue behind them and a
 *    small screen; a scrolling form of seven questions reads as work and is
 *    abandoned. One question reads as a conversation.
 *  · Selection auto-advances after a short beat. That beat is not decoration —
 *    it lets the user *see* the choice register before the screen changes, which
 *    is what stops the "did that work?" back-tap. It halves the number of taps
 *    versus select-then-Next.
 *  · Back is always available and never loses an answer. Users second-guess
 *    themselves on the salt question in particular.
 *  · Progress is always visible. An unbounded form is abandoned; a form showing
 *    "3 of 7" is finished.
 *  · Every answer is persisted to sessionStorage on change, so a dropped
 *    connection or an accidental back-swipe on Android does not cost the user
 *    the whole audit.
 */

const LIFESTYLE_STEPS = [
  "sleep",
  "sodium",
  "stress",
  "stimulants",
  "activity",
] as const;

type LifestyleStep = (typeof LIFESTYLE_STEPS)[number];

/** All seven steps: five lifestyle, one history, one reading. */
const TOTAL_STEPS = LIFESTYLE_STEPS.length + 2;

export function AuditFlow({ campaign }: { campaign?: string }) {
  const t = useTranslations("audit");
  const tc = useTranslations("common");
  const router = useRouter();

  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Partial<LifestyleAnswers>>({});
  const [lastCheck, setLastCheck] = useState<Level | undefined>();

  // Restore an interrupted attempt.
  useEffect(() => {
    const draft = readDraft();
    if (!draft) return;
    setAnswers(draft.answers ?? {});
    if (draft.lastCheck) setLastCheck(draft.lastCheck);
  }, []);

  const persist = useCallback(
    (next: Partial<LifestyleAnswers>, check?: Level) => {
      writeDraft({ answers: next, lastCheck: check ?? lastCheck, campaign });
    },
    [campaign, lastCheck],
  );

  const selectLifestyle = (factor: LifestyleStep, level: Level) => {
    const next = { ...answers, [factor]: level };
    setAnswers(next);
    persist(next);
    // Let the checkmark render before moving on.
    window.setTimeout(() => setStep((s) => s + 1), 180);
  };

  const selectLastCheck = (level: Level) => {
    setLastCheck(level);
    persist(answers, level);
    window.setTimeout(() => setStep((s) => s + 1), 180);
  };

  const finish = (reading: BpReading | null) => {
    const complete = answers as LifestyleAnswers;
    // Hand off through sessionStorage rather than the URL: a blood-pressure
    // reading in a query string ends up in browser history, in server logs and
    // in any analytics that records the path. Health data does not belong there.
    writeDraft({ answers: complete, lastCheck, reading, campaign });
    router.push("/results");
  };

  const progress = useMemo(() => Math.min(step + 1, TOTAL_STEPS), [step]);

  return (
    <div className="mx-auto flex min-h-dvh max-w-xl flex-col px-5 pb-10">
      {/* ── Progress ─────────────────────────────────────────────────── */}
      <div className="pt-6">
        <div className="flex items-center gap-3">
          {step > 0 && (
            <button
              type="button"
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              aria-label={tc("back")}
              className="tap -ms-2 flex items-center justify-center rounded-xl text-ink-600 hover:bg-ink-100"
            >
              <ArrowLeft size={22} aria-hidden className="rtl:rotate-180" />
            </button>
          )}
          <p className="text-sm font-semibold text-ink-500">
            {t("progress", { current: progress, total: TOTAL_STEPS })}
          </p>
        </div>

        <div
          className="mt-3 h-2 w-full overflow-hidden rounded-full bg-ink-100"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={1}
          aria-valuemax={TOTAL_STEPS}
        >
          <div
            className="brand-gradient h-full rounded-full transition-[width] duration-300"
            style={{ width: `${(progress / TOTAL_STEPS) * 100}%` }}
          />
        </div>
      </div>

      {/* ── Question ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 flex-col justify-center py-8">
        {step < LIFESTYLE_STEPS.length && (
          <LifestyleQuestion
            key={LIFESTYLE_STEPS[step]}
            factor={LIFESTYLE_STEPS[step]!}
            selected={answers[LIFESTYLE_STEPS[step]!]}
            onSelect={(level) => selectLifestyle(LIFESTYLE_STEPS[step]!, level)}
          />
        )}

        {step === LIFESTYLE_STEPS.length && (
          <Question
            question={t("lastCheck.question")}
            help={t("lastCheck.help")}
            options={LEVELS.map((level) => ({
              level,
              label: t(`lastCheck.${level}`),
            }))}
            selected={lastCheck}
            onSelect={selectLastCheck}
          />
        )}

        {step === LIFESTYLE_STEPS.length + 1 && (
          <div>
            <h1 className="text-2xl leading-snug font-bold text-ink-900">
              {t("reading.question")}
            </h1>
            <p className="mt-2 text-base text-ink-500">{t("reading.help")}</p>
            <div className="mt-7">
              <BpEntry onSubmit={finish} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LifestyleQuestion({
  factor,
  selected,
  onSelect,
}: {
  factor: LifestyleStep;
  selected?: Level;
  onSelect: (level: Level) => void;
}) {
  const t = useTranslations("audit");
  return (
    <Question
      question={t(`${factor}.question`)}
      help={t(`${factor}.help`)}
      options={LEVELS.map((level) => ({ level, label: t(`${factor}.${level}`) }))}
      selected={selected}
      onSelect={onSelect}
    />
  );
}

function Question({
  question,
  help,
  options,
  selected,
  onSelect,
}: {
  question: string;
  help: string;
  options: Array<{ level: Level; label: string }>;
  selected?: Level;
  onSelect: (level: Level) => void;
}) {
  return (
    <fieldset>
      <legend>
        <h1 className="text-2xl leading-snug font-bold text-balance text-ink-900">
          {question}
        </h1>
        <p className="mt-2 text-base text-ink-500">{help}</p>
      </legend>

      <div className="mt-7 space-y-3">
        {options.map(({ level, label }) => {
          const isSelected = selected === level;
          return (
            <button
              key={level}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelect(level)}
              className={[
                "flex w-full items-center justify-between gap-4 rounded-2xl border-2 p-5 text-start",
                "min-h-[4.5rem] text-lg font-medium transition-colors duration-150",
                isSelected
                  ? "border-cyan-500 bg-cyan-100 text-ink-900"
                  : "border-ink-200 bg-white text-ink-800 hover:border-ink-400 active:bg-ink-50",
              ].join(" ")}
            >
              <span className="text-balance">{label}</span>
              <span
                aria-hidden
                className={[
                  "flex size-7 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                  isSelected
                    ? "border-cyan-500 bg-cyan-500 text-white"
                    : "border-ink-300 bg-transparent",
                ].join(" ")}
              >
                {isSelected && <Check size={16} strokeWidth={3} />}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
