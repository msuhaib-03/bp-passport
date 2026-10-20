import { z } from "zod";

import { authenticate, json } from "@/lib/api/context";
import { decryptPii, encryptPii } from "@/lib/api/pii";
export { corsOptions as OPTIONS } from "@/lib/api/cors";

const registration = z.object({
  name: z.string().trim().min(2).max(120),
  pmdcNumber: z.string().trim().regex(/^[A-Za-z0-9/-]{4,24}$/),
  clinicName: z.string().trim().min(2).max(160),
  city: z.string().trim().min(2).max(80),
}).strict();

function profileDto(row: {
  id: string;
  pmdc_number: string;
  name_enc: string;
  clinic_name: string;
  city: string;
  status: string;
  subscription_active: boolean;
  created_at: string;
}) {
  let name: string | null = null;
  try { name = decryptPii(row.name_enc); } catch { /* key unavailable or rotated */ }
  return {
    id: row.id,
    name,
    pmdcNumber: row.pmdc_number,
    clinicName: row.clinic_name,
    city: row.city,
    status: row.status,
    subscriptionActive: row.subscription_active,
    createdAt: row.created_at,
  };
}

export async function GET(request: Request) {
  const ctx = await authenticate(request);
  if (ctx.error) return ctx.error;
  if (!ctx.user.email || !ctx.user.email_confirmed_at) return json({ error: "A confirmed email account is required" }, 403);
  const result = await ctx.client.from("clinicians")
    .select("id,pmdc_number,name_enc,clinic_name,city,status,subscription_active,created_at")
    .eq("auth_user_id", ctx.user.id).maybeSingle();
  if (result.error) return json({ error: "Unable to read clinician profile" }, 500);
  return result.data ? json({ profile: profileDto(result.data) }) : json({ profile: null });
}

export async function POST(request: Request) {
  const ctx = await authenticate(request);
  if (ctx.error) return ctx.error;
  if (!ctx.user.email || !ctx.user.email_confirmed_at) return json({ error: "Create and confirm an email account first" }, 403);
  const parsed = registration.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid clinician registration" }, 400);

  let encryptedName: string;
  try { encryptedName = encryptPii(parsed.data.name); }
  catch { return json({ error: "Clinician registration is not configured" }, 503); }

  const result = await ctx.client.from("clinicians").insert({
    auth_user_id: ctx.user.id,
    pmdc_number: parsed.data.pmdcNumber.toUpperCase(),
    name_enc: encryptedName,
    clinic_name: parsed.data.clinicName,
    city: parsed.data.city,
    status: "pending",
    subscription_active: false,
  }).select("id,pmdc_number,name_enc,clinic_name,city,status,subscription_active,created_at").single();
  if (result.error) {
    return json({ error: result.error.code === "23505" ? "This PMDC number or account is already registered" : "Unable to register clinician" }, result.error.code === "23505" ? 409 : 500);
  }
  return json({ profile: profileDto(result.data) }, 201);
}
