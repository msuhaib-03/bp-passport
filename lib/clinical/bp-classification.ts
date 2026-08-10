/**
 * Blood-pressure classification — the single clinical source of truth.
 *
 * Thresholds follow the **ISH 2020 Global Hypertension Practice Guidelines**
 * office-BP categories, which is the framework the Pakistan Hypertension League
 * (PHL) endorses. Every threshold in this file is a named constant so that a
 * clinical reviewer can audit and sign off on one screen of code.
 *
 * ┌───────────────────────┬────────────┬─────────┬────────────┐
 * │ Category              │ SBP        │         │ DBP        │
 * ├───────────────────────┼────────────┼─────────┼────────────┤
 * │ Optimal               │ < 120      │ and     │ < 80       │
 * │ Normal                │ 120–129    │ and/or  │ 80–84      │
 * │ High normal           │ 130–139    │ and/or  │ 85–89      │
 * │ Grade 1 hypertension  │ 140–159    │ and/or  │ 90–99      │
 * │ Grade 2 hypertension  │ ≥ 160      │ and/or  │ ≥ 100      │
 * └───────────────────────┴────────────┴─────────┴────────────┘
 *
 * REGULATORY POSTURE (DRAP Class A)
 * ---------------------------------
 * This module classifies a *measurement*. It does not diagnose a *person*.
 * A single elevated reading is not hypertension — diagnosis requires repeated
 * measurement by a licensed practitioner. Every consumer of this module must
 * present its output as an observation ("this reading is in the Grade 1 range")
 * and never as a condition ("you have hypertension"). See `drap-guardrail.ts`,
 * which enforces that distinction on outbound copy.
 */

export const BP_CATEGORIES = [
  "optimal",
  "normal",
  "high_normal",
  "grade_1",
  "grade_2",
] as const;

export type BpCategory = (typeof BP_CATEGORIES)[number];

/** How quickly the reading warrants human contact. Independent of category. */
export type BpUrgency = "routine" | "soon" | "urgent" | "emergency";

/** Physiologically plausible input bounds for a screening kiosk. */
export const BP_LIMITS = {
  systolic: { min: 60, max: 260 },
  diastolic: { min: 30, max: 160 },
} as const;

/**
 * Hypertensive crisis thresholds (ACC/AHA). Held separately from the ISH
 * category ladder because urgency is a safety concern, not a classification:
 * a reading can be Grade 2 without being a crisis, and the app must react to
 * each fact differently.
 */
export const CRISIS_THRESHOLD = { systolic: 180, diastolic: 120 } as const;

/** Lower bound at which we advise same-week contact rather than routine follow-up. */
export const SOON_THRESHOLD = { systolic: 160, diastolic: 100 } as const;

const CATEGORY_RANK: Record<BpCategory, number> = {
  optimal: 0,
  normal: 1,
  high_normal: 2,
  grade_1: 3,
  grade_2: 4,
};

export interface BpReading {
  systolic: number;
  diastolic: number;
}

export interface BpAssessment {
  systolic: number;
  diastolic: number;
  category: BpCategory;
  /** ISH category rank, 0 (optimal) … 4 (grade 2). Useful for gauges. */
  rank: number;
  urgency: BpUrgency;
  /** Mean arterial pressure, (SBP + 2·DBP) / 3, to one decimal place. */
  map: number;
  /** Pulse pressure, SBP − DBP. A value > 60 is a marker of arterial stiffness. */
  pulsePressure: number;
  /** SBP ≥ 140 while DBP < 90 — a distinct pattern, common with age. */
  isolatedSystolic: boolean;
  /** True when the reading is at or beyond the hypertensive-crisis threshold. */
  isCrisis: boolean;
}

export class InvalidReadingError extends Error {
  constructor(
    readonly reason:
      | "systolic_out_of_range"
      | "diastolic_out_of_range"
      | "systolic_not_above_diastolic"
      | "not_a_number",
  ) {
    super(`Invalid blood-pressure reading: ${reason}`);
    this.name = "InvalidReadingError";
  }
}

/**
 * Validates a reading before it is ever classified or stored.
 *
 * A screening kiosk receives typos. Silently classifying `1200/80` would put a
 * fabricated crisis in a patient's permanent record, so this throws instead.
 */
export function assertValidReading(reading: BpReading): void {
  const { systolic, diastolic } = reading;

  if (!Number.isFinite(systolic) || !Number.isFinite(diastolic)) {
    throw new InvalidReadingError("not_a_number");
  }
  if (systolic < BP_LIMITS.systolic.min || systolic > BP_LIMITS.systolic.max) {
    throw new InvalidReadingError("systolic_out_of_range");
  }
  if (diastolic < BP_LIMITS.diastolic.min || diastolic > BP_LIMITS.diastolic.max) {
    throw new InvalidReadingError("diastolic_out_of_range");
  }
  // Systolic is by definition the peak of the cardiac cycle. Equal or inverted
  // values mean the two fields were transposed on entry.
  if (systolic <= diastolic) {
    throw new InvalidReadingError("systolic_not_above_diastolic");
  }
}

export function isValidReading(reading: BpReading): boolean {
  try {
    assertValidReading(reading);
    return true;
  } catch {
    return false;
  }
}

/** Category implied by the systolic value alone. */
function categoriseSystolic(systolic: number): BpCategory {
  if (systolic >= 160) return "grade_2";
  if (systolic >= 140) return "grade_1";
  if (systolic >= 130) return "high_normal";
  if (systolic >= 120) return "normal";
  return "optimal";
}

/** Category implied by the diastolic value alone. */
function categoriseDiastolic(diastolic: number): BpCategory {
  if (diastolic >= 100) return "grade_2";
  if (diastolic >= 90) return "grade_1";
  if (diastolic >= 85) return "high_normal";
  if (diastolic >= 80) return "normal";
  return "optimal";
}

/**
 * ISH 2020 uses "and/or" logic: the reading takes the **higher** of the two
 * categories. A patient at 135/95 is Grade 1 on the strength of the diastolic
 * value alone — treating it as "high normal" because the systolic is 135 would
 * under-triage them.
 */
export function classify(reading: BpReading): BpCategory {
  assertValidReading(reading);
  const bySystolic = categoriseSystolic(reading.systolic);
  const byDiastolic = categoriseDiastolic(reading.diastolic);
  return CATEGORY_RANK[bySystolic] >= CATEGORY_RANK[byDiastolic] ? bySystolic : byDiastolic;
}

function determineUrgency(reading: BpReading, category: BpCategory): BpUrgency {
  const { systolic, diastolic } = reading;
  if (systolic >= CRISIS_THRESHOLD.systolic || diastolic >= CRISIS_THRESHOLD.diastolic) {
    return "emergency";
  }
  if (systolic >= SOON_THRESHOLD.systolic || diastolic >= SOON_THRESHOLD.diastolic) {
    return "urgent";
  }
  if (category === "grade_1" || category === "grade_2") return "soon";
  return "routine";
}

/** Mean arterial pressure, rounded to one decimal. */
export function meanArterialPressure(reading: BpReading): number {
  return Math.round(((reading.systolic + 2 * reading.diastolic) / 3) * 10) / 10;
}

/** Full assessment of a single reading. Throws on implausible input. */
export function assess(reading: BpReading): BpAssessment {
  assertValidReading(reading);
  const { systolic, diastolic } = reading;
  const category = classify(reading);

  return {
    systolic,
    diastolic,
    category,
    rank: CATEGORY_RANK[category],
    urgency: determineUrgency(reading, category),
    map: meanArterialPressure(reading),
    pulsePressure: systolic - diastolic,
    isolatedSystolic: systolic >= 140 && diastolic < 90,
    isCrisis:
      systolic >= CRISIS_THRESHOLD.systolic || diastolic >= CRISIS_THRESHOLD.diastolic,
  };
}

/**
 * Summarises a series of readings the way a clinician reads a home diary:
 * the mean ± SD over the window, not the most recent single value.
 *
 * This is what the Clinician Portal renders. A GP cannot titrate from one
 * reading, and showing them raw daily values is the reason paper diaries fail.
 */
export interface BpSeriesSummary {
  count: number;
  meanSystolic: number;
  meanDiastolic: number;
  sdSystolic: number;
  sdDiastolic: number;
  /** Category of the mean reading — the clinically meaningful figure. */
  category: BpCategory;
  /** mmHg change in systolic across the window; negative is improvement. */
  systolicTrend: number;
  highestSystolic: number;
  anyCrisis: boolean;
}

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/** Sample standard deviation (n−1). Returns 0 for a single reading. */
function standardDeviation(values: number[]): number {
  if (values.length < 2) return 0;
  const mu = mean(values);
  const variance =
    values.reduce((sum, v) => sum + (v - mu) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

const round1 = (n: number) => Math.round(n * 10) / 10;

/**
 * @param readings Chronologically ordered, oldest first.
 */
export function summariseSeries(readings: BpReading[]): BpSeriesSummary | null {
  const valid = readings.filter(isValidReading);
  if (valid.length === 0) return null;

  const systolics = valid.map((r) => r.systolic);
  const diastolics = valid.map((r) => r.diastolic);
  const meanSys = mean(systolics);
  const meanDia = mean(diastolics);

  // Trend compares the first and second half of the window rather than first
  // and last reading, so one anomalous measurement cannot invent a trend.
  const midpoint = Math.floor(valid.length / 2);
  const firstHalf = systolics.slice(0, midpoint || 1);
  const secondHalf = systolics.slice(midpoint);
  const trend = valid.length < 4 ? 0 : round1(mean(secondHalf) - mean(firstHalf));

  const roundedMean = { systolic: Math.round(meanSys), diastolic: Math.round(meanDia) };

  return {
    count: valid.length,
    meanSystolic: round1(meanSys),
    meanDiastolic: round1(meanDia),
    sdSystolic: round1(standardDeviation(systolics)),
    sdDiastolic: round1(standardDeviation(diastolics)),
    // Guard the edge case where a rounded mean inverts (e.g. 90.4/90.2 → 90/90).
    category: isValidReading(roundedMean) ? classify(roundedMean) : classify(valid[0]!),
    systolicTrend: trend,
    highestSystolic: Math.max(...systolics),
    anyCrisis: valid.some((r) => assess(r).isCrisis),
  };
}
