import { z } from "zod";
import { patientContext, json } from "@/lib/api/context";
export { corsOptions as OPTIONS } from "@/lib/api/cors";
const input = z.object({ scope: z.enum(["storage", "research", "marketing", "clinician_sharing"]), granted: z.boolean(), policyVersion: z.string().min(1).max(64), locale: z.enum(["en", "ur"]) }).strict();
export async function GET(request: Request) {
  const ctx = await patientContext(request); if (ctx.error) return ctx.error;
  const result = await ctx.client.from("consents").select("id,scope,granted,policy_version,locale,recorded_at").eq("patient_id",ctx.patientId).order("recorded_at",{ascending:false}).limit(200);
  return result.error ? json({error:"Unable to read consent history"},500) : json(result.data);
}
export async function POST(request: Request) {
  const ctx = await patientContext(request); if (ctx.error) return ctx.error;
  const parsed = input.safeParse(await request.json().catch(()=>null));
  if (!parsed.success) return json({error:"Invalid consent payload"},400);
  const p = parsed.data;
  const result = await ctx.client.from("consents").insert({patient_id:ctx.patientId,scope:p.scope,granted:p.granted,policy_version:p.policyVersion,locale:p.locale});
  return result.error ? json({error:"Unable to record consent"},500) : json({recorded:true},201);
}
