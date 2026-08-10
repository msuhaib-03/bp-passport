/**
 * DRAP Class A guardrail — enforced in code, not in policy.
 *
 * THE REGULATORY LINE
 * -------------------
 * Under the DRAP Medical Devices Rules 2017, software that produces a diagnosis
 * or recommends a therapy is Class B Software as a Medical Device and requires
 * ISO 13485 and a pre-market review measured in months. Software that educates
 * and refers is Class A. BP Passport is built to stay on the Class A side of
 * that line, permanently.
 *
 * Separately, PPMA pharmaceutical marketing rules prohibit a pharma-affiliated
 * platform from steering patients toward a molecule. Because the sponsor holds a
 * cardiovascular portfolio, this is the single highest-consequence compliance
 * boundary in the product.
 *
 * WHY A CODE GUARDRAIL AND NOT A STYLE GUIDE
 * ------------------------------------------
 * A style guide is advice. This is a function that every outbound patient-facing
 * string passes through, and it fails closed: on a violation it replaces the copy
 * with a safe fallback and writes an audit record. That is the difference between
 * a policy that holds under a deadline and one that does not.
 *
 * It applies to model output *and* to hand-written copy, because a well-meaning
 * developer writing "you have stage 1 hypertension" in a template is exactly as
 * much of a regulatory breach as a model generating it.
 */

/**
 * Molecules and brands that must never appear in patient-facing output.
 *
 * Includes the sponsor's own cardiovascular portfolio (Byvas, Tansin, Avsar,
 * Telsarta, Treatan) — naming those would convert a public-health tool into
 * promotional material — plus the common antihypertensive classes a model might
 * volunteer unprompted.
 */
export const PROHIBITED_DRUG_TERMS = [
  // Sponsor brands
  "byvas", "tansin", "avsar", "telsarta", "treatan",
  // Molecules
  "nebivolol", "losartan", "valsartan", "telmisartan", "candesartan",
  "irbesartan", "olmesartan", "amlodipine", "nifedipine", "diltiazem",
  "verapamil", "metoprolol", "atenolol", "bisoprolol", "carvedilol",
  "propranolol", "lisinopril", "enalapril", "ramipril", "captopril",
  "perindopril", "hydrochlorothiazide", "chlorthalidone", "indapamide",
  "spironolactone", "furosemide", "clonidine", "methyldopa", "prazosin",
  "sacubitril", "aspirin", "atorvastatin", "rosuvastatin", "simvastatin",
  // Classes stated as a recommendation vector
  "ace inhibitor", "arb", "beta blocker", "beta-blocker",
  "calcium channel blocker", "thiazide", "diuretic",
] as const;

/**
 * Phrasings that assert a diagnosis or direct a therapy.
 *
 * Note what is *not* here: "hypertension" alone is permitted, because the app
 * must be able to say "hypertension affects 32.5 million Pakistanis" and
 * "readings in this range are called Grade 1 hypertension". The violation is
 * attaching the condition to the *person* — the second-person construction.
 */
export const PROHIBITED_DIAGNOSTIC_PHRASES = [
  // Diagnosis attached to the reader
  "you have hypertension",
  "you have high blood pressure",
  "you are hypertensive",
  "you have stage",
  "you have grade",
  "you are diagnosed",
  "your diagnosis",
  "diagnosis:",
  "you suffer from",
  "you have been diagnosed",
  "this confirms you have",
  "you definitely have",
  // Therapeutic direction
  "you should take",
  "you must take",
  "start taking",
  "stop taking",
  "increase your dose",
  "decrease your dose",
  "reduce your dose",
  "double your dose",
  "skip your dose",
  "adjust your medication",
  "change your medication",
  "we recommend the drug",
  "prescribe",
  "prescription for",
  "mg twice daily",
  "mg once daily",
  "mg per day",
  // Urdu equivalents — the same rules apply in both languages
  "آپ کو ہائی بلڈ پریشر ہے",
  "آپ کو بلڈ پریشر ہے",
  "دوا لینا شروع کریں",
  "دوا بند کریں",
  "خوراک بڑھائیں",
] as const;

export type ViolationKind = "drug_name" | "diagnostic_phrase";

export interface GuardrailViolation {
  kind: ViolationKind;
  term: string;
}

export interface GuardrailResult {
  ok: boolean;
  violations: GuardrailViolation[];
  /** The original text when clean; the safe fallback when not. */
  text: string;
}

/**
 * Copy served when output is blocked. Educational, refers to a human, asserts
 * nothing. Deliberately the same in both languages' fallback slot so a blocked
 * response is never a blank screen.
 */
export const SAFE_FALLBACK = {
  en:
    "I can't answer that one. For anything about medicines or a diagnosis, " +
    "please speak to a doctor — they can look at your readings and advise you properly. " +
    "You can share your 14-day chart with them from your Passport.",
  ur:
    "میں اس کا جواب نہیں دے سکتا۔ دوا یا تشخیص کے بارے میں کسی ڈاکٹر سے بات کریں — " +
    "وہ آپ کی ریڈنگز دیکھ کر درست مشورہ دے سکتے ہیں۔ آپ اپنا 14 دن کا چارٹ " +
    "پاسپورٹ سے ان کے ساتھ شیئر کر سکتے ہیں۔",
} as const;

export type Locale = keyof typeof SAFE_FALLBACK;

function normalise(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[ً-ٰٟۖ-ۭ]/g, "")
    .replace(/\s+/g, " ");
}

/** Word-boundary match so "arb" does not fire on "arbitrary". */
function containsTerm(haystack: string, term: string): boolean {
  const normalisedTerm = normalise(term);
  // Latin-script terms get word boundaries; Urdu-script terms are matched as
  // substrings because Urdu has no reliable \b in JavaScript regex.
  if (/^[a-z0-9 :.-]+$/.test(normalisedTerm)) {
    const escaped = normalisedTerm.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`).test(haystack);
  }
  return haystack.includes(normalisedTerm);
}

/** Inspects text without modifying it. Use for tests and for linting copy. */
export function inspect(text: string): GuardrailViolation[] {
  const haystack = normalise(text);
  const violations: GuardrailViolation[] = [];

  for (const term of PROHIBITED_DRUG_TERMS) {
    if (containsTerm(haystack, term)) violations.push({ kind: "drug_name", term });
  }
  for (const phrase of PROHIBITED_DIAGNOSTIC_PHRASES) {
    if (containsTerm(haystack, phrase)) {
      violations.push({ kind: "diagnostic_phrase", term: phrase });
    }
  }
  return violations;
}

/**
 * The gate. Every patient-facing string — model output, template copy, coach
 * reply — passes through here before it reaches a screen.
 *
 * Fails closed: on any violation the original text is discarded entirely rather
 * than redacted, because a partially-redacted clinical sentence can invert its
 * own meaning ("do not [REDACTED] your dose").
 *
 * @param onViolation Audit sink. In production this writes to `audit_log` and
 *                    raises a compliance alert; a violation in a deployed build
 *                    is a defect, not a routine event.
 */
export function guard(
  text: string,
  locale: Locale = "en",
  onViolation?: (violations: GuardrailViolation[], original: string) => void,
): GuardrailResult {
  const violations = inspect(text);

  if (violations.length === 0) {
    return { ok: true, violations: [], text };
  }

  onViolation?.(violations, text);
  return { ok: false, violations, text: SAFE_FALLBACK[locale] };
}

/**
 * Safe phrasing helpers, so correct copy is the path of least resistance.
 *
 * The distinction these encode: describe the *reading*, never label the
 * *person*. "This reading is in the Grade 1 range" is Class A. "You have Grade 1
 * hypertension" is Class B.
 */
export const SAFE_PHRASING = {
  en: {
    optimal: "This reading is in the optimal range.",
    normal: "This reading is in the normal range.",
    high_normal: "This reading is in the high-normal range.",
    grade_1: "This reading is in the Grade 1 range.",
    grade_2: "This reading is in the Grade 2 range.",
  },
  ur: {
    optimal: "یہ ریڈنگ بہترین حد میں ہے۔",
    normal: "یہ ریڈنگ نارمل حد میں ہے۔",
    high_normal: "یہ ریڈنگ نارمل سے زیادہ حد میں ہے۔",
    grade_1: "یہ ریڈنگ گریڈ 1 کی حد میں ہے۔",
    grade_2: "یہ ریڈنگ گریڈ 2 کی حد میں ہے۔",
  },
} as const;
