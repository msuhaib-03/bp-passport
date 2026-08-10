/**
 * Maps clinical state to visual state.
 *
 * Kept apart from `bp-classification.ts` on purpose: that module is the clinical
 * contract PHL signs off on and must not carry styling concerns. This module
 * decides how a category *looks*, and it is the one place to change if the
 * palette moves.
 *
 * ACCESSIBILITY CONTRACT — every risk state carries FOUR redundant signals:
 *   1. colour        (cyan → amber → coral; never red/green)
 *   2. a text label  (localised, always rendered)
 *   3. a glyph       (distinct shape per tier)
 *   4. a position    (rank 0–4 on the scale component)
 * Any one of these alone is sufficient to distinguish the state. That is what
 * makes the product usable by someone with colour-vision deficiency, someone
 * reading in bright sunlight at a kiosk, and someone who cannot read at all.
 */

import type { BpCategory, BpUrgency } from "./bp-classification";
import type { ScoreBand } from "./heart-score";

export interface CategoryVisual {
  /** Solid accent — bars, dots, emphasis text. */
  accent: string;
  /** Tinted surface for cards and pills. */
  surface: string;
  /** Text colour with AA contrast on `surface`. */
  onSurface: string;
  /** Distinct shape so colour is never the only cue. */
  glyph: "check" | "minus" | "alert-low" | "alert-mid" | "alert-high";
}

export const CATEGORY_VISUAL: Record<BpCategory, CategoryVisual> = {
  optimal: {
    accent: "var(--color-risk-optimal)",
    surface: "var(--color-risk-optimal-soft)",
    onSurface: "var(--color-risk-optimal-ink)",
    glyph: "check",
  },
  normal: {
    accent: "var(--color-risk-normal)",
    surface: "var(--color-risk-normal-soft)",
    onSurface: "var(--color-risk-normal-ink)",
    glyph: "minus",
  },
  high_normal: {
    accent: "var(--color-risk-high-normal)",
    surface: "var(--color-risk-high-normal-soft)",
    onSurface: "var(--color-risk-high-normal-ink)",
    glyph: "alert-low",
  },
  grade_1: {
    accent: "var(--color-risk-grade1)",
    surface: "var(--color-risk-grade1-soft)",
    onSurface: "var(--color-risk-grade1-ink)",
    glyph: "alert-mid",
  },
  grade_2: {
    accent: "var(--color-risk-grade2)",
    surface: "var(--color-risk-grade2-soft)",
    onSurface: "var(--color-risk-grade2-ink)",
    glyph: "alert-high",
  },
};

export const CRISIS_VISUAL: CategoryVisual = {
  accent: "var(--color-risk-crisis)",
  surface: "var(--color-risk-crisis-soft)",
  onSurface: "var(--color-risk-crisis-ink)",
  glyph: "alert-high",
};

/** Heart Score band → accent. Uses the same scale so the two readouts agree. */
export const BAND_ACCENT: Record<ScoreBand, string> = {
  strong: "var(--color-risk-optimal)",
  moderate: "var(--color-risk-normal)",
  needs_attention: "var(--color-risk-high-normal)",
  at_risk: "var(--color-risk-grade1)",
};

/**
 * Whether the UI should interrupt the user.
 *
 * Only `emergency` interrupts. Everything else is delivered in the normal flow —
 * a screening tool that shouts at people for a Grade 1 reading trains them to
 * dismiss it, and then the shout that matters is ignored too.
 */
export function shouldInterrupt(urgency: BpUrgency): boolean {
  return urgency === "emergency";
}

/**
 * Position of a systolic value on the 0–1 visual scale.
 *
 * Piecewise-linear against the ISH boundaries rather than linear across the raw
 * range, so each category occupies equal visual width. A purely linear scale
 * would squeeze optimal-to-high-normal — the range where most users actually
 * sit, and where the differences matter most — into a sliver.
 */
export function scalePosition(systolic: number): number {
  const stops = [90, 120, 130, 140, 160, 190];
  const bandWidth = 1 / (stops.length - 1);

  if (systolic <= stops[0]!) return 0;
  if (systolic >= stops[stops.length - 1]!) return 1;

  for (let i = 0; i < stops.length - 1; i += 1) {
    const lo = stops[i]!;
    const hi = stops[i + 1]!;
    if (systolic <= hi) {
      return bandWidth * (i + (systolic - lo) / (hi - lo));
    }
  }
  return 1;
}
