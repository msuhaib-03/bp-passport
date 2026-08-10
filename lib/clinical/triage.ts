/**
 * Deterministic emergency triage — runs BEFORE any language model.
 *
 * WHY THIS IS NOT AI
 * ------------------
 * This is the one component in the platform that must never be probabilistic.
 * A model that is 99% reliable at recognising "I have crushing chest pain" is
 * unacceptable when the 1% is a myocardial infarction. So red-flag detection is
 * a deterministic keyword-and-threshold classifier that executes first, and if
 * it fires the model is never called at all — the user gets an emergency card
 * and a hotline number.
 *
 * BILINGUAL BY NECESSITY
 * ----------------------
 * Pakistani users type in three registers, often within one sentence: English,
 * Urdu script, and Roman Urdu ("seenay mein dard"). A classifier that matches
 * only one register will miss most real messages. All three are matched here.
 *
 * Ordering note: this classifier is intentionally biased toward false positives.
 * Sending a well patient to a clinic is a cost; missing a stroke is not.
 */

import { CRISIS_THRESHOLD, type BpReading } from "./bp-classification";

export type RedFlagKind =
  | "cardiac"
  | "stroke"
  | "hypertensive_crisis"
  | "respiratory"
  | "neurological"
  | "obstetric";

export interface TriageResult {
  /** True when the user must be routed to emergency care immediately. */
  isEmergency: boolean;
  kinds: RedFlagKind[];
  /** The specific phrases that matched, for the audit log. */
  matched: string[];
}

/**
 * Emergency hotlines. NICVD is Pakistan's national cardiovascular institute and
 * runs a 24/7 chest-pain service; 1122 is the Rescue emergency line.
 */
export const EMERGENCY_CONTACTS = {
  nicvd: "021-99201271",
  rescue: "1122",
} as const;

interface FlagPattern {
  kind: RedFlagKind;
  /** Lower-cased substrings. Matched against a normalised message. */
  phrases: string[];
}

/**
 * Red-flag phrase sets.
 *
 * Each entry deliberately uses short, high-specificity fragments rather than
 * whole sentences, because users type fragments. Fragments that are too short
 * to be specific (e.g. "dard" = pain, on its own) are excluded — they would
 * fire on "mera ghutna dard" (my knee hurts) and train users to ignore the
 * emergency card, which is worse than not showing it.
 */
const FLAG_PATTERNS: FlagPattern[] = [
  {
    kind: "cardiac",
    phrases: [
      // English
      "chest pain",
      "chest pressure",
      "chest tightness",
      "tightness in my chest",
      "pain in my chest",
      "crushing pain",
      "pain in my left arm",
      "pain spreading to my jaw",
      "heart attack",
      // Roman Urdu
      "seenay mein dard",
      "seene mein dard",
      "seene me dard",
      "chaati mein dard",
      "dil ka dora",
      "dil mein dard",
      // Urdu script
      "سینے میں درد",
      "سینے میں دباؤ",
      "دل کا دورہ",
    ],
  },
  {
    kind: "stroke",
    phrases: [
      "worst headache of my life",
      "worst headache",
      "sudden severe headache",
      "face is drooping",
      "one side of my body",
      "cannot move my arm",
      "can't move my arm",
      "slurred speech",
      "cannot speak properly",
      "sudden numbness",
      "sudden weakness",
      // Roman Urdu
      "zindagi ka sab se bara sar dard",
      "sakht sar dard",
      "shadeed sar dard",
      "zubaan lardkhara",
      "aadha jism",
      "haath nahi hil raha",
      // Urdu script
      "شدید سر درد",
      "زبان لڑکھڑا",
      "آدھا جسم",
      "فالج",
    ],
  },
  {
    kind: "neurological",
    phrases: [
      "blurry vision",
      "blurred vision",
      // Both word orders. Users say "my vision is blurry" at least as often as
      // "blurry vision", and a classifier that only matches the adjective-first
      // form silently misses half of real messages.
      "vision is blurry",
      "vision is blurred",
      "vision has gone blurry",
      "eyesight is blurry",
      "eyes are blurry",
      "seeing blurry",
      "everything is blurry",
      "double vision",
      "cannot see properly",
      "can't see properly",
      "sudden vision loss",
      "vision went dark",
      "fainted",
      "passed out",
      "lost consciousness",
      "confused and disoriented",
      "having a seizure",
      "fit ho gaya",
      // Roman Urdu
      "nazar dhundli",
      "nazar dhundhli",
      "dhundla nazar",
      "behosh",
      "chakkar aur nazar",
      // Urdu script
      "نظر دھندلی",
      "بے ہوش",
      "دورہ پڑ",
    ],
  },
  {
    kind: "respiratory",
    phrases: [
      "cannot breathe",
      "can't breathe",
      "struggling to breathe",
      "shortness of breath",
      "gasping for air",
      "breathless lying down",
      // Roman Urdu
      "saans nahi aa rahi",
      "sans nahi aa rahi",
      "saans phool",
      "dam ghut",
      // Urdu script
      "سانس نہیں آ",
      "سانس پھول",
      "دم گھٹ",
    ],
  },
  {
    kind: "obstetric",
    phrases: [
      // Pre-eclampsia: high BP in pregnancy is an emergency at lower thresholds
      // than in the general population, so pregnancy plus any BP concern routes
      // straight to care.
      "pregnant and my blood pressure",
      "pregnant and high blood pressure",
      "pregnant with swelling",
      "hamal aur blood pressure",
      "حاملہ اور بلڈ پریشر",
    ],
  },
];

/**
 * Normalises a message for matching: lower-cases, strips Arabic diacritics
 * (which users add inconsistently), normalises Urdu character variants, and
 * collapses whitespace and punctuation runs.
 */
export function normaliseMessage(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFKD")
    // Arabic/Urdu combining marks — harakat, tashkeel.
    .replace(/[ً-ٰٟۖ-ۭ]/g, "")
    // Urdu yeh/heh variants that users mix freely.
    .replace(/ي/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/ہ/g, "ۃ")
    .replace(/[.,!?;:()\[\]"'`]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Scans free text for emergency red flags. */
export function triageMessage(message: string): TriageResult {
  const haystack = normaliseMessage(message);
  const kinds = new Set<RedFlagKind>();
  const matched: string[] = [];

  for (const { kind, phrases } of FLAG_PATTERNS) {
    for (const phrase of phrases) {
      if (haystack.includes(normaliseMessage(phrase))) {
        kinds.add(kind);
        matched.push(phrase);
      }
    }
  }

  return { isEmergency: kinds.size > 0, kinds: [...kinds], matched };
}

/** Threshold check on a reading, independent of any text. */
export function triageReading(reading: BpReading): TriageResult {
  const isCrisis =
    reading.systolic >= CRISIS_THRESHOLD.systolic ||
    reading.diastolic >= CRISIS_THRESHOLD.diastolic;

  return {
    isEmergency: isCrisis,
    kinds: isCrisis ? ["hypertensive_crisis"] : [],
    matched: isCrisis ? [`${reading.systolic}/${reading.diastolic}`] : [],
  };
}

/**
 * The gate every conversational turn passes through.
 *
 * Call this first. If `isEmergency` is true, render the emergency card and
 * return — do not call a model, do not generate advice, do not offer a
 * lifestyle tip. Both signals are combined so that a calm message accompanying
 * a crisis-level reading still triggers.
 */
export function triage(message: string, reading?: BpReading | null): TriageResult {
  const fromText = triageMessage(message);
  const fromReading = reading ? triageReading(reading) : null;

  if (!fromReading?.isEmergency) return fromText;

  return {
    isEmergency: true,
    kinds: [...new Set([...fromText.kinds, ...fromReading.kinds])],
    matched: [...fromText.matched, ...fromReading.matched],
  };
}
