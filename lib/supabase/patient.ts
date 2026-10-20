import { apiJson } from "./api";

export type ConsentScope = "essential" | "research" | "reminders";

export interface ConsentRecord {
  id: string;
  scope: ConsentScope;
  granted: boolean;
  policy_version: string;
  locale: "en" | "ur";
  recorded_at: string;
}

export async function fetchConsents(): Promise<ConsentRecord[]> {
  return apiJson<ConsentRecord[]>("/api/v1/consents");
}

export async function recordConsent(
  scope: ConsentScope,
  granted: boolean,
  locale: "en" | "ur",
): Promise<void> {
  await apiJson("/api/v1/consents", {
    method: "POST",
    body: {
      scope,
      granted,
      locale,
      policyVersion: process.env.NEXT_PUBLIC_CONSENT_POLICY_VERSION || "v1",
    },
  });
}

export interface PatientShare {
  share_id: string;
  pmdc_number: string;
  clinic_name: string;
  city: string;
  expires_at: string;
  revoked_at: string | null;
  first_accessed_at: string | null;
  access_count: number;
  created_at: string;
}

export async function fetchPatientShares(): Promise<PatientShare[]> {
  const data = await apiJson<{ shares: PatientShare[] }>("/api/v1/share");
  return data.shares;
}

export async function createPatientShare(pmdcNumber: string): Promise<{
  id: string;
  token: string;
  expiresAt: string;
  clinician: { pmdcNumber: string; clinicName: string; city: string };
}> {
  return apiJson("/api/v1/share/create", {
    method: "POST",
    body: { pmdcNumber },
  });
}

export async function revokePatientShare(id: string): Promise<void> {
  await apiJson(`/api/v1/share/${encodeURIComponent(id)}`, { method: "DELETE" });
}
