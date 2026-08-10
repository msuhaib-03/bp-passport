/**
 * Heart Score — a modifiable-lifestyle composite, 5 to 100.
 *
 * WHAT THIS IS
 * ------------
 * A motivational index over five lifestyle factors that the patient can
 * actually change, plus a contribution from their current blood-pressure
 * reading. It exists to answer the question a screening subject actually asks:
 * *"what should I do first?"* — which a BP category alone cannot answer.
 *
 * WHAT THIS IS NOT
 * ----------------
 * Not a diagnosis, not a validated cardiovascular risk score, and not a
 * substitute for one. It is deliberately NOT called a "risk score": Framingham,
 * QRISK and WHO/ISH charts are validated instruments that predict events over
 * years, and claiming equivalence would be both false and a DRAP Class B
 * regulatory exposure. Clinical severity is always communicated through
 * `bp-classification.ts`; the Heart Score sits alongside it as a lifestyle lever.
 *
 * WEIGHTS ARE PROVISIONAL
 * -----------------------
 * The penalty weights below are evidence-informed but NOT yet clinically
 * validated. They are the artefact requiring PHL sign-off before public launch
 * (decision D-25). Every weight lives in `LIFESTYLE_WEIGHTS` and
 * `BP_PENALTY_BY_CATEGORY` so a reviewer can audit the whole model on one
 * screen, and `tests/heart-score.test.ts` pins all 3⁵ = 243 lifestyle
 * combinations so any change to a weight fails loudly.
 */

import { assess, type BpCategory, type BpReading } from "./bp-classification";

/** The five modifiable dimensions, in the order the quiz asks them. */
export const LIFESTYLE_FACTORS = [
  "sleep",
  "sodium",
  "stress",
  "stimulants",
  "activity",
] as const;

export type LifestyleFactor = (typeof LIFESTYLE_FACTORS)[number];

/** Every factor uses the same three-level scale: better → worse. */
export const LEVELS = ["good", "fair", "poor"] as const;
export type Level = (typeof LEVELS)[number];

export type LifestyleAnswers = Record<LifestyleFactor, Level>;

/**
 * Penalty in Heart Score points for each factor at each level.
 *
 * Relative magnitudes reflect the strength of each factor's association with
 * blood pressure in the literature — dietary sodium and physical inactivity
 * carry the largest modifiable effect on systolic BP, so they carry the largest
 * penalties. Total lifestyle penalty is capped at 50 by construction
 * (12 + 12 + 10 + 8 + 8), leaving 45 for the BP contribution and a floor of 5.
 */
export const LIFESTYLE_WEIGHTS: Record<LifestyleFactor, Record<Level, number>> = {
  // Sodium: the single most modifiable dietary driver of systolic pressure, and
  // the most actionable in a South Asian diet (achar, papad, dhaba salt).
  sodium: { good: 0, fair: 6, poor: 12 },
  // Physical inactivity: comparable effect size to sodium, and the factor most
  // responsive to a small, specific instruction ("a 30-minute walk").
  activity: { good: 0, fair: 6, poor: 12 },
  // Short sleep (< 6 h) raises sympathetic tone and nocturnal pressure.
  sleep: { good: 0, fair: 5, poor: 10 },
  // Psychological stress: real but harder to attribute and to change.
  stress: { good: 0, fair: 4, poor: 8 },
  // Caffeine and energy drinks: acute pressor effect, high prevalence in the
  // 18–40 cohort this platform targets.
  stimulants: { good: 0, fair: 4, poor: 8 },
};

/** Maximum possible lifestyle penalty, derived — never hard-coded. */
export const MAX_LIFESTYLE_PENALTY = LIFESTYLE_FACTORS.reduce(
  (total, factor) => total + LIFESTYLE_WEIGHTS[factor].poor,
  0,
);

/** Heart Score contribution of the current reading, by ISH category. */
export const BP_PENALTY_BY_CATEGORY: Record<BpCategory, number> = {
  optimal: 0,
  normal: 5,
  high_normal: 12,
  grade_1: 22,
  grade_2: 33,
};

/** Additional penalty when the reading is at hypertensive-crisis level. */
export const CRISIS_PENALTY = 12;

export const SCORE_FLOOR = 5;
export const SCORE_CEILING = 100;

/** Qualitative bands for the score. Presentational only — never clinical. */
export const SCORE_BANDS = ["strong", "moderate", "needs_attention", "at_risk"] as const;
export type ScoreBand = (typeof SCORE_BANDS)[number];

export interface FactorContribution {
  factor: LifestyleFactor;
  level: Level;
  /** Points lost to this factor. */
  penalty: number;
  /** Points recoverable by moving this factor to `good`. */
  headroom: number;
}

export interface HeartScoreResult {
  score: number;
  band: ScoreBand;
  lifestylePenalty: number;
  bpPenalty: number;
  contributions: FactorContribution[];
  /**
   * The factors with the most recoverable points, worst first. This is what the
   * results screen leads with — a score with no lever attached is just a grade,
   * and a grade does not change behaviour.
   */
  topLevers: FactorContribution[];
  /** Present only when a reading was supplied. */
  bp: ReturnType<typeof assess> | null;
}

function bandFor(score: number): ScoreBand {
  if (score >= 80) return "strong";
  if (score >= 60) return "moderate";
  if (score >= 40) return "needs_attention";
  return "at_risk";
}

/**
 * Computes the Heart Score.
 *
 * @param answers  The five lifestyle answers.
 * @param reading  Optional current BP reading. When omitted, the score reflects
 *                 lifestyle alone and `bpPenalty` is 0 — used when a subject
 *                 completes the audit without access to a cuff.
 */
export function calculateHeartScore(
  answers: LifestyleAnswers,
  reading?: BpReading | null,
): HeartScoreResult {
  const contributions: FactorContribution[] = LIFESTYLE_FACTORS.map((factor) => {
    const level = answers[factor];
    const penalty = LIFESTYLE_WEIGHTS[factor][level];
    return {
      factor,
      level,
      penalty,
      // Headroom equals the penalty: moving a factor to `good` recovers exactly
      // what it currently costs.
      headroom: penalty,
    };
  });

  const lifestylePenalty = contributions.reduce((sum, c) => sum + c.penalty, 0);

  let bp: HeartScoreResult["bp"] = null;
  let bpPenalty = 0;
  if (reading) {
    bp = assess(reading);
    bpPenalty = BP_PENALTY_BY_CATEGORY[bp.category] + (bp.isCrisis ? CRISIS_PENALTY : 0);
  }

  const raw = SCORE_CEILING - lifestylePenalty - bpPenalty;
  const score = Math.max(SCORE_FLOOR, Math.min(SCORE_CEILING, Math.round(raw)));

  const topLevers = contributions
    .filter((c) => c.headroom > 0)
    .sort((a, b) => b.headroom - a.headroom || a.factor.localeCompare(b.factor))
    .slice(0, 3);

  return {
    score,
    band: bandFor(score),
    lifestylePenalty,
    bpPenalty,
    contributions,
    topLevers,
    bp,
  };
}

/**
 * Projects the score the subject would reach by fixing their top levers.
 * Powers the "here is what's achievable" line on the results screen, which is
 * the strongest single driver of return visits in self-monitoring products.
 */
export function projectedScore(
  result: HeartScoreResult,
  leverCount = 2,
): number {
  const recoverable = result.topLevers
    .slice(0, leverCount)
    .reduce((sum, c) => sum + c.headroom, 0);
  return Math.min(SCORE_CEILING, result.score + recoverable);
}

/** All 243 lifestyle permutations. Used by the test suite and by fixtures. */
export function allLifestyleCombinations(): LifestyleAnswers[] {
  const combos: LifestyleAnswers[] = [];
  for (const sleep of LEVELS)
    for (const sodium of LEVELS)
      for (const stress of LEVELS)
        for (const stimulants of LEVELS)
          for (const activity of LEVELS)
            combos.push({ sleep, sodium, stress, stimulants, activity });
  return combos;
}
