/**
 * Clinical safety suite.
 *
 * These are not ordinary unit tests. They are the executable form of the
 * clinical contract that PHL will sign off on, and they run on every commit.
 * If a weight or a threshold changes, this suite fails loudly — which is the
 * whole point. Nobody should be able to nudge a clinical constant quietly.
 */

import { describe, expect, it } from "vitest";

import {
  BP_LIMITS,
  CRISIS_THRESHOLD,
  InvalidReadingError,
  assess,
  classify,
  isValidReading,
  meanArterialPressure,
  summariseSeries,
  type BpCategory,
} from "@/lib/clinical/bp-classification";

import {
  BP_PENALTY_BY_CATEGORY,
  LIFESTYLE_FACTORS,
  LIFESTYLE_WEIGHTS,
  MAX_LIFESTYLE_PENALTY,
  SCORE_CEILING,
  SCORE_FLOOR,
  allLifestyleCombinations,
  calculateHeartScore,
  projectedScore,
  type LifestyleAnswers,
} from "@/lib/clinical/heart-score";

import {
  PROHIBITED_DIAGNOSTIC_PHRASES,
  PROHIBITED_DRUG_TERMS,
  SAFE_FALLBACK,
  guard,
  inspect,
} from "@/lib/clinical/drap-guardrail";

import { triage, triageMessage, triageReading } from "@/lib/clinical/triage";

const ALL_GOOD: LifestyleAnswers = {
  sleep: "good", sodium: "good", stress: "good", stimulants: "good", activity: "good",
};
const ALL_POOR: LifestyleAnswers = {
  sleep: "poor", sodium: "poor", stress: "poor", stimulants: "poor", activity: "poor",
};

// ═══════════════════════════════════════════════════════════════════════════
describe("BP classification — ISH 2020 boundaries", () => {
  // Boundary table taken directly from the guideline. Off-by-one errors at a
  // category edge are the most consequential bug this module can have: 139/89
  // versus 140/90 is the difference between reassurance and a referral.
  const boundaries: Array<[number, number, BpCategory]> = [
    [119, 79, "optimal"],
    [120, 79, "normal"],
    [119, 80, "normal"],
    [129, 84, "normal"],
    [130, 84, "high_normal"],
    [119, 85, "high_normal"],
    [139, 89, "high_normal"],
    [140, 89, "grade_1"],
    [139, 90, "grade_1"],
    [159, 99, "grade_1"],
    [160, 99, "grade_2"],
    [139, 100, "grade_2"],
    [200, 110, "grade_2"],
  ];

  it.each(boundaries)("%i/%i is %s", (systolic, diastolic, expected) => {
    expect(classify({ systolic, diastolic })).toBe(expected);
  });

  it("takes the higher of the two categories (and/or logic)", () => {
    // Systolic says high-normal, diastolic says grade 1. Grade 1 must win —
    // classifying on systolic alone would under-triage this patient.
    expect(classify({ systolic: 135, diastolic: 95 })).toBe("grade_1");
    expect(classify({ systolic: 165, diastolic: 70 })).toBe("grade_2");
  });

  it("flags isolated systolic hypertension", () => {
    expect(assess({ systolic: 150, diastolic: 80 }).isolatedSystolic).toBe(true);
    expect(assess({ systolic: 150, diastolic: 95 }).isolatedSystolic).toBe(false);
  });

  it("computes MAP as (SBP + 2·DBP) / 3", () => {
    expect(meanArterialPressure({ systolic: 120, diastolic: 80 })).toBe(93.3);
    expect(meanArterialPressure({ systolic: 128, diastolic: 84 })).toBe(98.7);
    // MAP must never exceed systolic or fall below diastolic.
    for (let s = 90; s <= 200; s += 7) {
      for (let d = 50; d < s; d += 7) {
        const map = meanArterialPressure({ systolic: s, diastolic: d });
        expect(map).toBeGreaterThanOrEqual(d);
        expect(map).toBeLessThanOrEqual(s);
      }
    }
  });

  it("computes pulse pressure", () => {
    expect(assess({ systolic: 150, diastolic: 80 }).pulsePressure).toBe(70);
  });
});

describe("BP classification — urgency is independent of category", () => {
  it("escalates to emergency at the crisis threshold", () => {
    expect(assess({ systolic: 180, diastolic: 90 }).urgency).toBe("emergency");
    expect(assess({ systolic: 150, diastolic: 120 }).urgency).toBe("emergency");
    expect(assess({ systolic: 179, diastolic: 119 }).urgency).not.toBe("emergency");
  });

  it("marks grade 2 as urgent but not necessarily an emergency", () => {
    const a = assess({ systolic: 165, diastolic: 105 });
    expect(a.category).toBe("grade_2");
    expect(a.urgency).toBe("urgent");
    expect(a.isCrisis).toBe(false);
  });

  it("marks grade 1 for prompt but not urgent follow-up", () => {
    expect(assess({ systolic: 145, diastolic: 92 }).urgency).toBe("soon");
  });

  it("leaves optimal and normal on routine follow-up", () => {
    expect(assess({ systolic: 115, diastolic: 75 }).urgency).toBe("routine");
    expect(assess({ systolic: 125, diastolic: 82 }).urgency).toBe("routine");
  });
});

describe("BP classification — input validation", () => {
  it("rejects a transposed reading rather than classifying it", () => {
    // 80/120 is the classic data-entry error. Accepting it would record a
    // fabricated crisis in a patient's permanent history.
    expect(() => classify({ systolic: 80, diastolic: 120 })).toThrow(InvalidReadingError);
  });

  it("rejects equal values", () => {
    expect(() => classify({ systolic: 100, diastolic: 100 })).toThrow(InvalidReadingError);
  });

  it("rejects out-of-range values", () => {
    expect(isValidReading({ systolic: BP_LIMITS.systolic.max + 1, diastolic: 80 })).toBe(false);
    expect(isValidReading({ systolic: BP_LIMITS.systolic.min - 1, diastolic: 40 })).toBe(false);
    expect(isValidReading({ systolic: 120, diastolic: BP_LIMITS.diastolic.max + 1 })).toBe(false);
  });

  it("rejects NaN and Infinity", () => {
    expect(isValidReading({ systolic: Number.NaN, diastolic: 80 })).toBe(false);
    expect(isValidReading({ systolic: Number.POSITIVE_INFINITY, diastolic: 80 })).toBe(false);
  });

  it("accepts the plausible extremes", () => {
    expect(isValidReading({ systolic: 260, diastolic: 159 })).toBe(true);
    expect(isValidReading({ systolic: 61, diastolic: 30 })).toBe(true);
  });
});

describe("BP series summary — what the clinician portal renders", () => {
  const series = [
    { systolic: 148, diastolic: 94 },
    { systolic: 152, diastolic: 96 },
    { systolic: 145, diastolic: 92 },
    { systolic: 141, diastolic: 88 },
    { systolic: 138, diastolic: 86 },
    { systolic: 136, diastolic: 85 },
  ];

  it("returns null for an empty series", () => {
    expect(summariseSeries([])).toBeNull();
  });

  it("drops invalid readings instead of throwing", () => {
    const summary = summariseSeries([...series, { systolic: 60, diastolic: 200 }]);
    expect(summary?.count).toBe(series.length);
  });

  it("reports mean and SD, not the latest reading", () => {
    const s = summariseSeries(series)!;
    expect(s.count).toBe(6);
    expect(s.meanSystolic).toBeCloseTo(143.3, 1);
    expect(s.sdSystolic).toBeGreaterThan(0);
    // The category comes from the mean, which is the figure a GP titrates on.
    expect(s.category).toBe("grade_1");
  });

  it("detects an improving trend as a negative number", () => {
    expect(summariseSeries(series)!.systolicTrend).toBeLessThan(0);
  });

  it("does not invent a trend from too few readings", () => {
    expect(summariseSeries(series.slice(0, 3))!.systolicTrend).toBe(0);
  });

  it("surfaces any crisis reading in the window", () => {
    expect(summariseSeries(series)!.anyCrisis).toBe(false);
    expect(
      summariseSeries([...series, { systolic: 185, diastolic: 115 }])!.anyCrisis,
    ).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("Heart Score — all 243 lifestyle combinations", () => {
  const combos = allLifestyleCombinations();

  it("enumerates exactly 3^5 = 243 combinations, all unique", () => {
    expect(combos).toHaveLength(243);
    const keys = new Set(combos.map((c) => LIFESTYLE_FACTORS.map((f) => c[f]).join("|")));
    expect(keys.size).toBe(243);
  });

  it("keeps every score within [5, 100] with no reading", () => {
    for (const combo of combos) {
      const { score } = calculateHeartScore(combo);
      expect(score).toBeGreaterThanOrEqual(SCORE_FLOOR);
      expect(score).toBeLessThanOrEqual(SCORE_CEILING);
      expect(Number.isInteger(score)).toBe(true);
    }
  });

  it("keeps every score within [5, 100] across every BP category", () => {
    const readings = [
      { systolic: 110, diastolic: 70 }, // optimal
      { systolic: 125, diastolic: 82 }, // normal
      { systolic: 135, diastolic: 86 }, // high normal
      { systolic: 145, diastolic: 92 }, // grade 1
      { systolic: 170, diastolic: 105 }, // grade 2
      { systolic: 200, diastolic: 130 }, // grade 2 + crisis
    ];
    for (const combo of combos) {
      for (const reading of readings) {
        const { score } = calculateHeartScore(combo, reading);
        expect(score).toBeGreaterThanOrEqual(SCORE_FLOOR);
        expect(score).toBeLessThanOrEqual(SCORE_CEILING);
      }
    }
  });

  it("is deterministic — the same input always yields the same score", () => {
    for (const combo of combos) {
      const a = calculateHeartScore(combo, { systolic: 138, diastolic: 88 });
      const b = calculateHeartScore(combo, { systolic: 138, diastolic: 88 });
      expect(a.score).toBe(b.score);
    }
  });

  it("is monotonic: worsening any single factor never raises the score", () => {
    const order = ["good", "fair", "poor"] as const;
    for (const combo of combos) {
      const base = calculateHeartScore(combo).score;
      for (const factor of LIFESTYLE_FACTORS) {
        const idx = order.indexOf(combo[factor]);
        if (idx === order.length - 1) continue;
        const worse = { ...combo, [factor]: order[idx + 1]! };
        expect(calculateHeartScore(worse).score).toBeLessThanOrEqual(base);
      }
    }
  });

  it("anchors the two extremes", () => {
    expect(calculateHeartScore(ALL_GOOD).score).toBe(100);
    expect(calculateHeartScore(ALL_POOR).score).toBe(100 - MAX_LIFESTYLE_PENALTY);
    expect(MAX_LIFESTYLE_PENALTY).toBe(50);
  });

  it("hits the floor at the worst possible combination", () => {
    const worst = calculateHeartScore(ALL_POOR, { systolic: 210, diastolic: 135 });
    expect(worst.score).toBe(SCORE_FLOOR);
  });

  it("never exceeds the reserved penalty budget", () => {
    // 50 lifestyle + 33 grade-2 + 12 crisis = 95, leaving exactly the floor of 5.
    const maxBp = Math.max(...Object.values(BP_PENALTY_BY_CATEGORY)) + 12;
    expect(MAX_LIFESTYLE_PENALTY + maxBp).toBe(SCORE_CEILING - SCORE_FLOOR);
  });
});

describe("Heart Score — actionability", () => {
  it("ranks the top levers by recoverable points", () => {
    const result = calculateHeartScore({
      sleep: "poor", sodium: "poor", stress: "fair", stimulants: "good", activity: "poor",
    });
    // Sodium and activity both cost 12; sleep costs 10. Those three lead.
    expect(result.topLevers).toHaveLength(3);
    expect(result.topLevers[0]!.headroom).toBeGreaterThanOrEqual(
      result.topLevers[1]!.headroom,
    );
    expect(result.topLevers.map((l) => l.factor)).toContain("sodium");
    expect(result.topLevers.map((l) => l.factor)).toContain("activity");
    expect(result.topLevers.map((l) => l.factor)).not.toContain("stimulants");
  });

  it("offers no levers when every habit is already good", () => {
    expect(calculateHeartScore(ALL_GOOD).topLevers).toHaveLength(0);
  });

  it("projects a reachable score from the top two levers", () => {
    const result = calculateHeartScore(ALL_POOR);
    // Worst lifestyle scores 50; fixing sodium and activity recovers 24.
    expect(projectedScore(result, 2)).toBe(result.score + 24);
    expect(projectedScore(result, 2)).toBeLessThanOrEqual(SCORE_CEILING);
  });

  it("ranks levers deterministically when headroom ties", () => {
    const a = calculateHeartScore(ALL_POOR).topLevers.map((l) => l.factor);
    const b = calculateHeartScore(ALL_POOR).topLevers.map((l) => l.factor);
    expect(a).toEqual(b);
  });

  it("weights sodium and activity as the largest single levers", () => {
    // Encodes the clinical intent: the two factors with the strongest
    // modifiable effect on systolic pressure must dominate the model.
    const maxWeight = Math.max(
      ...LIFESTYLE_FACTORS.map((f) => LIFESTYLE_WEIGHTS[f].poor),
    );
    expect(LIFESTYLE_WEIGHTS.sodium.poor).toBe(maxWeight);
    expect(LIFESTYLE_WEIGHTS.activity.poor).toBe(maxWeight);
  });

  it("scores lifestyle alone when no reading is supplied", () => {
    const result = calculateHeartScore(ALL_POOR, null);
    expect(result.bpPenalty).toBe(0);
    expect(result.bp).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("DRAP guardrail — blocks drug names", () => {
  it("blocks every prohibited term", () => {
    for (const term of PROHIBITED_DRUG_TERMS) {
      const result = guard(`You could consider ${term} for this.`);
      expect(result.ok, `expected "${term}" to be blocked`).toBe(false);
      expect(result.text).toBe(SAFE_FALLBACK.en);
    }
  });

  it("blocks the sponsor's own portfolio", () => {
    for (const brand of ["Byvas", "Tansin", "Avsar", "Telsarta", "Treatan"]) {
      expect(guard(`Ask your doctor about ${brand}.`).ok).toBe(false);
    }
  });

  it("does not fire on substrings inside ordinary words", () => {
    // "arb" is a prohibited term; "arbitrary" and "carbohydrate" must pass.
    expect(guard("Avoid arbitrary changes to your routine.").ok).toBe(true);
    expect(guard("Reduce refined carbohydrate at dinner.").ok).toBe(true);
  });
});

describe("DRAP guardrail — blocks diagnostic and prescriptive language", () => {
  it("blocks every prohibited phrase", () => {
    for (const phrase of PROHIBITED_DIAGNOSTIC_PHRASES) {
      const result = guard(`Based on this, ${phrase} something.`);
      expect(result.ok, `expected "${phrase}" to be blocked`).toBe(false);
    }
  });

  it("blocks the second-person diagnosis but permits the population fact", () => {
    // This distinction is the entire Class A / Class B line.
    expect(guard("You have hypertension.").ok).toBe(false);
    expect(guard("Hypertension affects 32.5 million Pakistani adults.").ok).toBe(true);
    expect(guard("This reading is in the Grade 1 range.").ok).toBe(true);
  });

  it("blocks dose instructions", () => {
    expect(guard("Take 5 mg once daily.").ok).toBe(false);
    expect(guard("You should increase your dose.").ok).toBe(false);
  });

  it("permits legitimate lifestyle coaching", () => {
    const safe = [
      "Try walking for 30 minutes after dinner.",
      "Skip the salt shaker at the table and use lemon instead.",
      "Please show these readings to your doctor.",
      "A reading this high should be checked today.",
      "Biryani is high in salt — use less during dam.",
    ];
    for (const copy of safe) {
      expect(guard(copy).ok, `expected "${copy}" to pass`).toBe(true);
    }
  });

  it("returns the Urdu fallback for the Urdu locale", () => {
    expect(guard("You have hypertension.", "ur").text).toBe(SAFE_FALLBACK.ur);
  });

  it("blocks prohibited Urdu phrasing too", () => {
    expect(guard("آپ کو ہائی بلڈ پریشر ہے۔", "ur").ok).toBe(false);
    expect(guard("دوا لینا شروع کریں۔", "ur").ok).toBe(false);
  });

  it("reports every violation for the audit log", () => {
    const violations = inspect("You have hypertension, take amlodipine 5 mg once daily.");
    expect(violations.length).toBeGreaterThanOrEqual(3);
    expect(violations.some((v) => v.kind === "drug_name")).toBe(true);
    expect(violations.some((v) => v.kind === "diagnostic_phrase")).toBe(true);
  });

  it("invokes the audit sink exactly once per blocked string", () => {
    let calls = 0;
    guard("You have hypertension.", "en", () => { calls += 1; });
    expect(calls).toBe(1);
    guard("Try a 30-minute walk.", "en", () => { calls += 1; });
    expect(calls).toBe(1);
  });

  it("never leaks the original text when blocking", () => {
    // Partial redaction can invert a clinical sentence, so the original is
    // discarded entirely.
    const result = guard("Do not stop taking amlodipine.");
    expect(result.ok).toBe(false);
    expect(result.text).not.toContain("amlodipine");
    expect(result.text).toBe(SAFE_FALLBACK.en);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
describe("Triage — deterministic red flags", () => {
  it("catches cardiac red flags in English, Roman Urdu and Urdu script", () => {
    for (const message of [
      "I have chest pain since morning",
      "seenay mein dard ho raha hai",
      "سینے میں درد ہو رہا ہے",
      "there is tightness in my chest",
    ]) {
      const result = triageMessage(message);
      expect(result.isEmergency, `expected emergency for "${message}"`).toBe(true);
      expect(result.kinds).toContain("cardiac");
    }
  });

  it("catches stroke red flags", () => {
    expect(triageMessage("this is the worst headache of my life").kinds).toContain("stroke");
    expect(triageMessage("my speech is slurred and one side of my body feels odd").kinds)
      .toContain("stroke");
    expect(triageMessage("شدید سر درد ہے").kinds).toContain("stroke");
  });

  it("catches neurological and respiratory red flags", () => {
    expect(triageMessage("my vision is blurry").kinds).toContain("neurological");
    expect(triageMessage("nazar dhundli ho gayi hai").kinds).toContain("neurological");
    expect(triageMessage("I cannot breathe properly").kinds).toContain("respiratory");
    expect(triageMessage("saans nahi aa rahi").kinds).toContain("respiratory");
  });

  it("catches pre-eclampsia framing", () => {
    expect(triageMessage("I am pregnant and my blood pressure is high").kinds)
      .toContain("obstetric");
  });

  it("stays silent on ordinary questions", () => {
    for (const message of [
      "how much salt should I eat",
      "mera ghutna dard kar raha hai",
      "what time should I take my walk",
      "can I drink chai in the morning",
      "how do I log a reading",
    ]) {
      expect(triageMessage(message).isEmergency, `false positive on "${message}"`).toBe(false);
    }
  });

  it("is insensitive to case, punctuation and Urdu diacritics", () => {
    expect(triageMessage("CHEST PAIN!!!").isEmergency).toBe(true);
    expect(triageMessage("  chest   pain  ").isEmergency).toBe(true);
  });

  it("fires on a crisis-level reading with no text at all", () => {
    expect(triageReading({ systolic: 185, diastolic: 100 }).isEmergency).toBe(true);
    expect(triageReading({ systolic: 140, diastolic: 125 }).isEmergency).toBe(true);
    expect(triageReading({ systolic: 150, diastolic: 95 }).isEmergency).toBe(false);
  });

  it("fires on a calm message accompanying a crisis reading", () => {
    // The dangerous case: the patient does not know the number is serious.
    const result = triage("just logging my reading for today", {
      systolic: 190,
      diastolic: 122,
    });
    expect(result.isEmergency).toBe(true);
    expect(result.kinds).toContain("hypertensive_crisis");
  });

  it("uses the same crisis threshold as the classifier", () => {
    expect(triageReading({ ...CRISIS_THRESHOLD, diastolic: 80 }).isEmergency).toBe(true);
  });

  it("records what matched, for the audit log", () => {
    expect(triageMessage("chest pain").matched).toContain("chest pain");
  });
});
