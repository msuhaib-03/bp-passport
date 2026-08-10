"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Minus, Plus } from "lucide-react";

import { Button } from "@/components/ui/Button";
import {
  BP_LIMITS,
  isValidReading,
  type BpReading,
} from "@/lib/clinical/bp-classification";

/**
 * Blood-pressure entry — the hardest input in the product.
 *
 * WHY STEPPERS AND NOT A SLIDER
 * -----------------------------
 * A slider looks modern and is the wrong control here. Blood pressure needs
 * single-mmHg precision across a ~200-unit range, which on a phone means roughly
 * two pixels per unit — unusable for anyone with a tremor, thick fingers, or
 * essential hand tremor, all of which are more common in the hypertensive
 * population. Steppers give exact values, and the numeric keypad gives speed to
 * users who already know their numbers.
 *
 * OTHER DECISIONS
 * ---------------
 *  · Labelled "Upper number" / "Lower number", not "systolic" / "diastolic".
 *    Most people read the display on the machine; almost nobody knows which
 *    clinical term maps to which line.
 *  · Sensible starting values (120/80) rather than empty fields, so a user who
 *    is unsure still sees what a plausible reading looks like.
 *  · Validation is explanatory, not just refusal: transposed values are the most
 *    common error, so that case gets its own message telling the user what to fix.
 *  · The escape hatch is a peer of the submit button. Most people scanning a
 *    poster have no cuff, and if the form feels mandatory they abandon it.
 */

const STEP = 1;
const COARSE_STEP = 5;

interface BpEntryProps {
  onSubmit: (reading: BpReading | null) => void;
  initial?: BpReading | null;
}

export function BpEntry({ onSubmit, initial }: BpEntryProps) {
  const t = useTranslations("audit.reading");
  const tc = useTranslations("common");

  const [systolic, setSystolic] = useState(initial?.systolic ?? 120);
  const [diastolic, setDiastolic] = useState(initial?.diastolic ?? 80);
  const [touched, setTouched] = useState(false);

  const reading: BpReading = { systolic, diastolic };
  const inRange =
    systolic >= BP_LIMITS.systolic.min &&
    systolic <= BP_LIMITS.systolic.max &&
    diastolic >= BP_LIMITS.diastolic.min &&
    diastolic <= BP_LIMITS.diastolic.max;
  const transposed = inRange && systolic <= diastolic;
  const valid = isValidReading(reading);

  const error = touched && !valid
    ? transposed
      ? t("invalidPair")
      : t("outOfRange")
    : null;

  return (
    <div>
      <div className="grid grid-cols-2 gap-4">
        <NumberField
          label={tc("upper")}
          sublabel={tc("systolic")}
          value={systolic}
          min={BP_LIMITS.systolic.min}
          max={BP_LIMITS.systolic.max}
          onChange={(v) => {
            setSystolic(v);
            setTouched(true);
          }}
        />
        <NumberField
          label={tc("lower")}
          sublabel={tc("diastolic")}
          value={diastolic}
          min={BP_LIMITS.diastolic.min}
          max={BP_LIMITS.diastolic.max}
          onChange={(v) => {
            setDiastolic(v);
            setTouched(true);
          }}
        />
      </div>

      {/* Live preview in the form a machine displays it, so the user can compare
          against the cuff without translating anything. */}
      <p
        className="numeric mt-5 text-center text-3xl font-bold text-ink-900"
        aria-live="polite"
      >
        {systolic}/{diastolic}
        <span className="ms-2 align-middle text-sm font-medium text-ink-400">
          {tc("mmhg")}
        </span>
      </p>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl bg-[var(--color-risk-grade1-soft)] px-4 py-3 text-sm font-medium text-[var(--color-risk-grade1-ink)]"
        >
          {error}
        </p>
      )}

      <div className="mt-7 space-y-3">
        <Button
          size="lg"
          fullWidth
          disabled={!valid}
          onClick={() => onSubmit(reading)}
        >
          {tc("finish")}
        </Button>
        <Button variant="ghost" fullWidth onClick={() => onSubmit(null)}>
          {t("dontHaveIt")}
        </Button>
      </div>
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  sublabel: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function NumberField({ label, sublabel, value, min, max, onChange }: NumberFieldProps) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  return (
    <div className="rounded-2xl border-2 border-ink-200 bg-white p-4">
      <label className="block text-center">
        <span className="block text-sm font-bold text-ink-900">{label}</span>
        <span className="mt-0.5 block text-xs text-ink-400">{sublabel}</span>
        <input
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(e) => {
            const next = Number(e.target.value);
            if (Number.isFinite(next)) onChange(next);
          }}
          onBlur={(e) => onChange(clamp(Number(e.target.value) || min))}
          className="numeric mt-3 w-full rounded-xl bg-surface-sunken py-3 text-center text-4xl font-bold text-ink-900 focus:outline-none"
        />
      </label>

      <div className="mt-3 flex items-center justify-between gap-2">
        <StepButton
          direction="down"
          label={`${label} −${STEP}`}
          onClick={() => onChange(clamp(value - STEP))}
          onLongPress={() => onChange(clamp(value - COARSE_STEP))}
          disabled={value <= min}
        />
        <StepButton
          direction="up"
          label={`${label} +${STEP}`}
          onClick={() => onChange(clamp(value + STEP))}
          onLongPress={() => onChange(clamp(value + COARSE_STEP))}
          disabled={value >= max}
        />
      </div>
    </div>
  );
}

function StepButton({
  direction,
  label,
  onClick,
  onLongPress,
  disabled,
}: {
  direction: "up" | "down";
  label: string;
  onClick: () => void;
  onLongPress: () => void;
  disabled?: boolean;
}) {
  const Icon = direction === "up" ? Plus : Minus;
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      // Double-tap steps by 5, so reaching 165 from 120 does not take 45 taps.
      onDoubleClick={onLongPress}
      className="tap flex flex-1 items-center justify-center rounded-xl bg-ink-100 text-ink-800 transition-colors hover:bg-ink-200 active:bg-ink-300 disabled:opacity-30"
    >
      <Icon size={22} aria-hidden />
    </button>
  );
}
