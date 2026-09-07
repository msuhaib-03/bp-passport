import { NextResponse } from "next/server";
import { z } from "zod";

import { corsOptions, withCors } from "@/lib/api/cors";
import { assertValidReading } from "@/lib/clinical/bp-classification";
import { calculateHeartScore } from "@/lib/clinical/heart-score";
import { bearerToken, createAuthenticatedServerClient } from "@/lib/supabase/server";

const level = z.enum(["good", "fair", "poor"]);
const answers = z.object({
  sleep: level,
  sodium: level,
  stress: level,
  stimulants: level,
  activity: level,
});
const reading = z
  .object({
    systolic: z.number().int(),
    diastolic: z.number().int(),
    at: z.string().datetime().optional(),
  })
  .nullable();
const passportInput = z.object({
  passportCode: z.string().regex(/^PE-[A-HJ-NP-Z2-9]{4}$/),
  createdAt: z.string().datetime(),
  campaign: z.string().regex(/^[a-z0-9][a-z0-9-]{1,31}$/).optional(),
  answers,
  reading,
});

function errorResponse(message: string, status: number) {
  return withCors(NextResponse.json({ error: message }, { status }));
}

export function OPTIONS() {
  return corsOptions();
}

export async function GET(request: Request) {
  const token = bearerToken(request);
  if (!token) return errorResponse("Authentication required", 401);

  const client = createAuthenticatedServerClient(token);
  if (!client) return errorResponse("Supabase is not configured", 503);

  const user = await client.auth.getUser(token);
  if (user.error || !user.data.user) return errorResponse("Invalid session", 401);

  const patient = await client
    .from("patients")
    .select("id, passport_code, created_at, readings(*)")
    .eq("auth_user_id", user.data.user.id)
    .maybeSingle();
  if (patient.error) return errorResponse("Unable to read passport", 500);
  if (!patient.data) return errorResponse("Passport not found", 404);

  return withCors(NextResponse.json(patient.data));
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return errorResponse("Authentication required", 401);

  const client = createAuthenticatedServerClient(token);
  if (!client) return errorResponse("Supabase is not configured", 503);

  const user = await client.auth.getUser(token);
  if (user.error || !user.data.user) return errorResponse("Invalid session", 401);

  const parsed = passportInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid passport payload", 400);

  const input = parsed.data;
  if (input.reading) {
    try {
      assertValidReading(input.reading);
    } catch {
      return errorResponse("Invalid blood-pressure reading", 400);
    }
  }

  let campaignId: string | null = null;
  if (input.campaign) {
    const campaign = await client
      .from("campaigns")
      .select("id")
      .eq("code", input.campaign)
      .eq("active", true)
      .maybeSingle();
    if (campaign.error) return errorResponse("Unable to read campaign", 500);
    campaignId = campaign.data?.id ?? null;
  }

  const existing = await client
    .from("patients")
    .select("id, passport_code, created_at")
    .eq("auth_user_id", user.data.user.id)
    .maybeSingle();
  if (existing.error) return errorResponse("Unable to read patient", 500);

  let patientId = existing.data?.id;
  if (!patientId) {
    const created = await client
      .from("patients")
      .insert({
        auth_user_id: user.data.user.id,
        passport_code: input.passportCode,
        campaign_id: campaignId,
        registered_at: input.createdAt,
      })
      .select("id, passport_code, created_at")
      .single();
    if (created.error) return errorResponse("Unable to create patient", 500);
    patientId = created.data.id;
  }

  if (input.reading && !existing.data) {
    const score = calculateHeartScore(input.answers, input.reading).score;
    const checkin = await client.from("checkins").insert({
      patient_id: patientId,
      campaign_id: campaignId,
      systolic: input.reading.systolic,
      diastolic: input.reading.diastolic,
      sleep: input.answers.sleep,
      sodium: input.answers.sodium,
      stress: input.answers.stress,
      stimulants: input.answers.stimulants,
      activity: input.answers.activity,
      heart_score: score,
      score_version: "v1-provisional",
    });
    if (checkin.error) return errorResponse("Unable to save audit", 500);

    const longitudinal = await client.from("readings").insert({
      patient_id: patientId,
      systolic: input.reading.systolic,
      diastolic: input.reading.diastolic,
      logged_at: input.reading.at ?? input.createdAt,
    });
    if (longitudinal.error) return errorResponse("Unable to save reading", 500);
  }

  return withCors(NextResponse.json({
    patientId,
    passportCode: existing.data?.passport_code ?? input.passportCode,
  }, { status: existing.data ? 200 : 201 }));
}
