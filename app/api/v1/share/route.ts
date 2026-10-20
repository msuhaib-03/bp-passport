import { patientContext, json } from "@/lib/api/context";
export { corsOptions as OPTIONS } from "@/lib/api/cors";

export async function GET(request: Request) {
  const ctx = await patientContext(request);
  if (ctx.error) return ctx.error;
  const result = await ctx.client.rpc("patient_share_list");
  return result.error
    ? json({ error: "Unable to read sharing history" }, 500)
    : json({ shares: result.data ?? [] });
}
