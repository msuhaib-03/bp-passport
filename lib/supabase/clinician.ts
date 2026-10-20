import { apiJson } from "./api";

export interface ClinicianProfile {
  id: string;
  name: string | null;
  pmdcNumber: string;
  clinicName: string;
  city: string;
  status: "pending" | "verified" | "rejected" | "lapsed";
  subscriptionActive: boolean;
  createdAt: string;
}

export async function fetchClinicianProfile(): Promise<ClinicianProfile | null> {
  const data = await apiJson<{ profile: ClinicianProfile | null }>(
    "/api/v1/clinician/profile",
    { allowAnonymous: false },
  );
  return data.profile;
}

export async function registerClinician(input: {
  name: string;
  pmdcNumber: string;
  clinicName: string;
  city: string;
}): Promise<ClinicianProfile> {
  const data = await apiJson<{ profile: ClinicianProfile }>(
    "/api/v1/clinician/profile",
    { method: "POST", body: input, allowAnonymous: false },
  );
  return data.profile;
}

export interface ClinicianShare {
  share_id: string;
  patient_id: string;
  passport_code: string | null;
  expires_at: string;
  first_accessed_at: string | null;
  created_at: string;
}

export async function fetchClinicianPatients(): Promise<ClinicianShare[]> {
  const data = await apiJson<{ shares: ClinicianShare[] }>(
    "/api/v1/clinician/patients",
    { allowAnonymous: false },
  );
  return data.shares ?? [];
}

export interface SharedReading {
  systolic: number;
  diastolic: number;
  category: "optimal" | "normal" | "high_normal" | "grade_1" | "grade_2";
  urgency: "routine" | "soon" | "urgent" | "emergency";
  logged_at: string;
  taken_at_time: "morning" | "evening" | "random";
}

export interface PatientSummary {
  reading_count: number;
  mean_systolic: number;
  mean_diastolic: number;
  sd_systolic: number;
  sd_diastolic: number;
  mean_category: SharedReading["category"];
  morning_mean_systolic: number | null;
  evening_mean_systolic: number | null;
  highest_systolic: number;
  any_crisis: boolean;
  adherence_rate: number | null;
}

export async function openSharedPatient(reference: string): Promise<{
  patientId: string;
  readings: SharedReading[];
  summary: PatientSummary | null;
}> {
  return apiJson(`/api/v1/clinician/patients/${encodeURIComponent(reference)}`, {
    allowAnonymous: false,
  });
}
