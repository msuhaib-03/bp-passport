import { z } from "zod";
import { patientContext, json } from "@/lib/api/context";
export { corsOptions as OPTIONS } from "@/lib/api/cors";
const query = z.object({days:z.coerce.number().int().min(1).max(365).default(14),limit:z.coerce.number().int().min(1).max(200).default(30)});
export async function GET(request: Request) {
  const ctx=await patientContext(request); if(ctx.error) return ctx.error;
  const parsed=query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if(!parsed.success) return json({error:"Invalid history query"},400);
  const {days,limit}=parsed.data;
  const since=new Date(Date.now()-days*86400000).toISOString();
  const [logs,summary]=await Promise.all([
    ctx.client.from("readings").select("id,systolic,diastolic,category,urgency,map,taken_at_time,took_meds,low_salt,walked,logged_at").eq("patient_id",ctx.patientId).gte("logged_at",since).lte("logged_at",new Date().toISOString()).order("logged_at",{ascending:false}).limit(limit),
    ctx.client.rpc("patient_bp_summary",{p_patient:ctx.patientId,p_days:days}),
  ]);
  if(logs.error || summary.error) return json({error:"Unable to read history"},500);
  return json({logs:logs.data,summary:summary.data?.[0]??null,days,limit});
}
