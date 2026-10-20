import { z } from "zod";

import { authenticate, json } from "@/lib/api/context";
import { corsOptions } from "@/lib/api/cors";
import { assertValidReading } from "@/lib/clinical/bp-classification";
import { calculateHeartScore } from "@/lib/clinical/heart-score";

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
    takenAtTime: z.enum(["morning", "evening", "random"]).optional(),
  })
  .nullable();
const passportInput = z.object({
  passportCode: z.string().regex(/^PE-[A-HJ-NP-Z2-9]{4}$/),
  createdAt: z.string().datetime(),
  campaign: z.string().regex(/^[a-z0-9][a-z0-9-]{1,31}$/).optional(),
  answers,
  reading,
  lastCheck: level.optional(),
  checkinEventId: z.string().uuid(),
  storageConsent: z.boolean(),
  policyVersion: z.string().trim().min(1).max(64),
  locale: z.enum(["en", "ur"]),
}).strict();

export function OPTIONS() {
  return corsOptions();
}

export async function GET(request: Request) {
  const ctx = await authenticate(request);
  if (ctx.error) return ctx.error;

  const patient = await ctx.client
    .from("patients")
    .select("id,auth_user_id,passport_code,created_at,readings(id,client_event_id,systolic,diastolic,taken_at_time,took_meds,low_salt,walked,logged_at),checkins(client_event_id,sleep,sodium,stress,stimulants,activity,last_check,created_at)")
    .eq("auth_user_id", ctx.user.id)
    .maybeSingle();
  if (patient.error) return json({ error: "Unable to read passport" }, 500);
  if (!patient.data) return json({ error: "Passport not found" }, 404);

  return json(patient.data);
}

export async function POST(request: Request) {
  const ctx = await authenticate(request);
  if (ctx.error) return ctx.error;

  const parsed = passportInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid passport payload" }, 400);

  const input = parsed.data;
  if (input.reading) {
    try {
      assertValidReading(input.reading);
    } catch {
      return json({ error: "Invalid blood-pressure reading" }, 400);
    }
  }

  let campaignId: string | null = null;
  if (input.campaign) {
    const campaign = await ctx.client
      .from("campaigns")
      .select("id")
      .eq("code", input.campaign)
      .eq("active", true)
      .maybeSingle();
    if (campaign.error) return json({ error: "Unable to read campaign" }, 500);
    campaignId = campaign.data?.id ?? null;
  }

  const result = await ctx.client.rpc("sync_passport", {
    p_code: input.passportCode,
    p_created: input.createdAt,
    p_campaign: campaignId,
    p_answers: input.answers,
    p_reading: input.reading,
    p_score: calculateHeartScore(input.answers, input.reading).score,
    p_last_check: input.lastCheck ?? null,
    p_event: input.checkinEventId,
    p_grant_storage: input.storageConsent,
    p_policy: input.policyVersion,
    p_locale: input.locale,
  });
  if (result.error) {
    return json(
      { error: "Unable to save passport" },
      result.error.code === "23505" ? 409 : 500,
    );
  }
  const saved = result.data?.[0];
  if (!saved) return json({ error: "Unable to save passport" }, 500);
  return json({
    patientId: saved.patient_id,
    passportCode: saved.passport_code,
  }, saved.created ? 201 : 200);
}
