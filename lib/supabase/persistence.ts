import type { LoggedReading, Passport } from "@/lib/storage";
import { ensureAnonymousSession } from "./browser";

async function apiRequest(
  path: string,
  accessToken: string,
  body?: unknown,
  method = "POST",
): Promise<Response> {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "";
  return fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

export async function syncNewPassport(passport: Passport): Promise<void> {
  const session = await ensureAnonymousSession();
  if (!session) return;
  const response = await apiRequest("/api/v1/passports", session.accessToken, {
    passportCode: passport.id,
    createdAt: passport.createdAt,
    campaign: passport.campaign,
    answers: passport.answers,
    reading: passport.readings[0] ?? null,
  });
  if (!response.ok) throw new Error("Passport sync failed");
}

export async function syncReading(reading: LoggedReading): Promise<void> {
  const session = await ensureAnonymousSession();
  if (!session) return;

  const response = await apiRequest("/api/v1/readings", session.accessToken, reading);
  if (!response.ok) throw new Error("Reading sync failed");
}

export async function fetchCloudPassport(): Promise<Passport | null> {
  const session = await ensureAnonymousSession();
  if (!session) return null;

  const response = await apiRequest("/api/v1/passports", session.accessToken, undefined, "GET");
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Passport fetch failed");

  const data = (await response.json()) as {
    checkins: Array<Passport["answers"] & { created_at: string }>;
    passport_code: string;
    created_at: string;
    readings: Array<{
      systolic: number;
      diastolic: number;
      logged_at: string;
      took_meds: boolean | null;
      low_salt: boolean | null;
      walked: boolean | null;
    }>;
  };

  return {
    id: data.passport_code,
    createdAt: data.created_at,
    answers: data.checkins?.sort((a,b) => b.created_at.localeCompare(a.created_at))[0] ?? {
      sleep: "good",
      sodium: "good",
      stress: "good",
      stimulants: "good",
      activity: "good",
    },
    readings: data.readings.map((reading) => ({
      systolic: reading.systolic,
      diastolic: reading.diastolic,
      at: reading.logged_at,
      tookMeds: reading.took_meds ?? undefined,
      lowSalt: reading.low_salt ?? undefined,
      walked: reading.walked ?? undefined,
    })),
  };
}

export function isCloudPersistenceConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}

