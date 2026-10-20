import type { LoggedReading, Passport } from "@/lib/storage";
import { apiJson } from "./api";

export async function syncPassport(
  passport: Passport,
  grantStorageConsent = false,
): Promise<void> {
  const checkinEventId = passport.lastAuditId;
  if (!checkinEventId) throw new Error("Passport has no audit event ID");
  const auditReading = passport.readings.find(
    (reading) => reading.clientId === checkinEventId,
  );
  await apiJson("/api/v1/passports", {
    method: "POST",
    body: {
    passportCode: passport.id,
    createdAt: passport.createdAt,
    campaign: passport.campaign,
    answers: passport.answers,
      lastCheck: passport.lastCheck,
      checkinEventId,
      storageConsent: grantStorageConsent,
      policyVersion: process.env.NEXT_PUBLIC_CONSENT_POLICY_VERSION || "v1",
      locale: document.documentElement.lang === "ur" ? "ur" : "en",
      reading: auditReading
        ? {
            systolic: auditReading.systolic,
            diastolic: auditReading.diastolic,
            at: auditReading.at,
            takenAtTime: auditReading.takenAtTime ?? "random",
          }
        : null,
    },
  });
}

export async function syncReading(reading: LoggedReading): Promise<void> {
  await apiJson("/api/v1/readings", { method: "POST", body: reading });
}

export async function fetchCloudPassport(): Promise<Passport | null> {
  let data: {
    auth_user_id: string;
    checkins: Array<Passport["answers"] & {
      client_event_id: string | null;
      last_check: Passport["lastCheck"] | null;
      created_at: string;
    }>;
    passport_code: string;
    created_at: string;
    readings: Array<{
      id: string;
      client_event_id: string | null;
      systolic: number;
      diastolic: number;
      logged_at: string;
      taken_at_time: LoggedReading["takenAtTime"];
      took_meds: boolean | null;
      low_salt: boolean | null;
      walked: boolean | null;
    }>;
  };
  try {
    data = await apiJson("/api/v1/passports");
  } catch (error) {
    if (error instanceof Error && "status" in error && error.status === 404) return null;
    throw error;
  }

  const checkins = [...(data.checkins ?? [])].sort((a, b) =>
    b.created_at.localeCompare(a.created_at),
  );
  const latestCheckin = checkins[0];
  const readings = (data.readings ?? []).map((reading) => ({
    clientId: reading.client_event_id ?? `server:${reading.id}`,
    serverId: reading.id,
    systolic: reading.systolic,
    diastolic: reading.diastolic,
    at: reading.logged_at,
    takenAtTime: reading.taken_at_time ?? "random",
    tookMeds: reading.took_meds ?? undefined,
    lowSalt: reading.low_salt ?? undefined,
    walked: reading.walked ?? undefined,
  })).sort((a, b) => a.at.localeCompare(b.at));

  return {
    id: data.passport_code,
    createdAt: data.created_at,
    cloudOwnerId: data.auth_user_id,
    lastAuditId: latestCheckin?.client_event_id ?? undefined,
    lastAuditAt: latestCheckin?.created_at ?? undefined,
    lastCheck: latestCheckin?.last_check ?? undefined,
    answers: latestCheckin ?? {
      sleep: "good",
      sodium: "good",
      stress: "good",
      stimulants: "good",
      activity: "good",
    },
    readings,
  };
}

export async function syncMissingReadings(
  localPassport: Passport,
  cloudPassport: Passport | null,
): Promise<void> {
  const cloudKeys = new Set(cloudPassport?.readings.map((reading) => reading.clientId) ?? []);
  const pending = localPassport.readings.filter(
    (reading) => !reading.clientId.startsWith("server:") && !cloudKeys.has(reading.clientId),
  );
  await Promise.all(pending.map((reading) => syncReading(reading)));
}

export function isCloudPersistenceConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

