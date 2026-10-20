import { z } from "zod";

import { hasAdminAccess } from "@/lib/api/admin";
import { json } from "@/lib/api/context";
import { corsOptions } from "@/lib/api/cors";
import { decryptPii } from "@/lib/api/pii";
import { createServiceServerClient } from "@/lib/supabase/server";

const reviewInput = z.object({
  clinicianId: z.string().uuid(),
  status: z.enum(["verified", "rejected"]),
}).strict();

export function OPTIONS() {
  return corsOptions();
}

export async function GET(request: Request) {
  if (!hasAdminAccess(request)) return json({ error: "Invalid admin credential" }, 401);
  const client = createServiceServerClient();
  if (!client) return json({ error: "Administrative review is not configured" }, 503);

  const result = await client
    .from("clinicians")
    .select("id,pmdc_number,name_enc,clinic_name,city,status,created_at,updated_at")
    .in("status", ["pending", "rejected"])
    .order("created_at", { ascending: true })
    .limit(200);
  if (result.error) return json({ error: "Unable to read clinician registrations" }, 500);

  return json({
    clinicians: (result.data ?? []).map((row) => {
      let name: string | null = null;
      try { name = decryptPii(row.name_enc); } catch { /* encrypted data stays opaque */ }
      return {
        id: row.id,
        name,
        pmdcNumber: row.pmdc_number,
        clinicName: row.clinic_name,
        city: row.city,
        status: row.status,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    }),
  });
}

export async function POST(request: Request) {
  if (!hasAdminAccess(request)) return json({ error: "Invalid admin credential" }, 401);
  const client = createServiceServerClient();
  if (!client) return json({ error: "Administrative review is not configured" }, 503);
  const parsed = reviewInput.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json({ error: "Invalid clinician review" }, 400);

  const result = await client.rpc("review_clinician", {
    p_clinician: parsed.data.clinicianId,
    p_status: parsed.data.status,
  });
  if (result.error || !result.data?.[0]) {
    return json({ error: result.error?.code === "P0002" ? "Clinician not found" : "Unable to review clinician" }, result.error?.code === "P0002" ? 404 : 500);
  }
  return json({ reviewed: true, clinician: result.data[0] });
}
