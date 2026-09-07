import { NextResponse } from "next/server";
import { z } from "zod";

import { corsOptions, withCors } from "@/lib/api/cors";
import { assertValidReading } from "@/lib/clinical/bp-classification";
import { bearerToken, createAuthenticatedServerClient } from "@/lib/supabase/server";

const readingInput = z.object({
  systolic: z.number().int(),
  diastolic: z.number().int(),
  at: z.string().datetime(),
  tookMeds: z.boolean().optional(),
  lowSalt: z.boolean().optional(),
  walked: z.boolean().optional(),
});

function errorResponse(message: string, status: number) {
  return withCors(NextResponse.json({ error: message }, { status }));
}

export function OPTIONS() {
  return corsOptions();
}

export async function POST(request: Request) {
  const token = bearerToken(request);
  if (!token) return errorResponse("Authentication required", 401);

  const client = createAuthenticatedServerClient(token);
  if (!client) return errorResponse("Supabase is not configured", 503);

  const user = await client.auth.getUser(token);
  if (user.error || !user.data.user) return errorResponse("Invalid session", 401);

  const parsed = readingInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("Invalid reading payload", 400);

  try {
    assertValidReading(parsed.data);
  } catch {
    return errorResponse("Invalid blood-pressure reading", 400);
  }

  const patient = await client
    .from("patients")
    .select("id")
    .eq("auth_user_id", user.data.user.id)
    .maybeSingle();
  if (patient.error) return errorResponse("Unable to read patient", 500);
  if (!patient.data) return errorResponse("Passport not found", 404);

  const result = await client.from("readings").insert({
    patient_id: patient.data.id,
    systolic: parsed.data.systolic,
    diastolic: parsed.data.diastolic,
    took_meds: parsed.data.tookMeds ?? null,
    low_salt: parsed.data.lowSalt ?? null,
    walked: parsed.data.walked ?? null,
    logged_at: parsed.data.at,
  });
  if (result.error) return errorResponse("Unable to save reading", 500);

  return withCors(NextResponse.json({ saved: true }, { status: 201 }));
}
