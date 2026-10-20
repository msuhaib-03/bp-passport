import type { Passport } from "./storage";

const CARE_KEY = "bpp.heartline.care.v1";

export type AssessmentAnswer = "no" | "sometimes" | "yes" | "not_sure" | "low" | "medium" | "high";

export interface CareAssessment {
  bpFrequency?: AssessmentAnswer;
  toldHighBp?: AssessmentAnswer;
  diabetes?: AssessmentAnswer;
  tobacco?: AssessmentAnswer;
  activity?: AssessmentAnswer;
  freshMeals?: AssessmentAnswer;
  familyHistory?: AssessmentAnswer;
  sleep?: AssessmentAnswer;
  missedMedicine?: AssessmentAnswer;
  redFlags?: AssessmentAnswer;
  completedAt?: string;
}

export interface MedicationReminder {
  id: string;
  label: string;
  schedule: string;
  active: boolean;
  checkedOn?: string;
}

export interface CaregiverSettings {
  name: string;
  relationship: string;
  permissions: {
    readings: boolean;
    reminders: boolean;
    reports: boolean;
  };
}

export interface CareState {
  version: 1;
  onboardingComplete: boolean;
  displayName: string;
  age?: number;
  gender?: "woman" | "man" | "other" | "prefer_not_to_say";
  accessMethod?: "qr" | "patient_id" | "biometric_demo";
  assessment: CareAssessment;
  medications: MedicationReminder[];
  caregiver: CaregiverSettings;
  updatedAt: string;
}

export function emptyCareState(passport?: Passport | null): CareState {
  return {
    version: 1,
    onboardingComplete: false,
    displayName: passport?.displayName ?? "",
    assessment: {},
    medications: [],
    caregiver: {
      name: "",
      relationship: "",
      permissions: { readings: true, reminders: true, reports: false },
    },
    updatedAt: new Date(0).toISOString(),
  };
}

export function readCareState(passport?: Passport | null): CareState {
  if (typeof window === "undefined") return emptyCareState(passport);
  try {
    const raw = window.localStorage.getItem(CARE_KEY);
    if (!raw) return emptyCareState(passport);
    const parsed = JSON.parse(raw) as Partial<CareState>;
    const base = emptyCareState(passport);
    return {
      ...base,
      ...parsed,
      version: 1,
      displayName: parsed.displayName || passport?.displayName || "",
      assessment: parsed.assessment ?? {},
      medications: Array.isArray(parsed.medications) ? parsed.medications : [],
      caregiver: {
        ...base.caregiver,
        ...(parsed.caregiver ?? {}),
        permissions: {
          ...base.caregiver.permissions,
          ...(parsed.caregiver?.permissions ?? {}),
        },
      },
    };
  } catch {
    return emptyCareState(passport);
  }
}

export function saveCareState(state: CareState): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(
      CARE_KEY,
      JSON.stringify({ ...state, version: 1, updatedAt: new Date().toISOString() }),
    );
    return true;
  } catch {
    return false;
  }
}

export function todayKey(now = new Date()): string {
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}
