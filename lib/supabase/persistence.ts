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

export function isCloudPersistenceConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
