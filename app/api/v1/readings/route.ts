import { z } from "zod";

import { patientContext, json } from "@/lib/api/context";
import { corsOptions } from "@/lib/api/cors";
import { assertValidReading } from "@/lib/clinical/bp-classification";

const readingInput = z.object({
  clientId: z.string().uuid(),
  systolic: z.number().int(),
  diastolic: z.number().int(),
  at: z.string().datetime(),
  takenAtTime: z.enum(["morning", "evening", "random"]).default("random"),
  tookMeds: z.boolean().optional(),
  lowSalt: z.boolean().optional(),
  walked: z.boolean().optional(),
}).strict();

export function OPTIONS() {
  return corsOptions();
}

export async function POST(request: Request) {
  const ctx = await patientContext(request);
  if (ctx.error) return ctx.error;

  const parsed = readingInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid reading payload" }, 400);

  try {
    assertValidReading(parsed.data);
  } catch {
    return json({ error: "Invalid blood-pressure reading" }, 400);
  }

  const result = await ctx.client.rpc("record_reading", {
    p_event: parsed.data.clientId,
    p_systolic: parsed.data.systolic,
    p_diastolic: parsed.data.diastolic,
    p_logged_at: parsed.data.at,
    p_taken_at_time: parsed.data.takenAtTime,
    p_took_meds: parsed.data.tookMeds ?? null,
    p_low_salt: parsed.data.lowSalt ?? null,
    p_walked: parsed.data.walked ?? null,
  });
  if (result.error || !result.data) return json({ error: "Unable to save reading" }, 500);

  return json({ saved: true, id: result.data }, 201);
}
