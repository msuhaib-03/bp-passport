import { authenticate, json } from "@/lib/api/context";
export { corsOptions as OPTIONS } from "@/lib/api/cors";
export async function GET(request:Request){
 const ctx=await authenticate(request);if(ctx.error)return ctx.error;
 const clinician=await ctx.client.from("clinicians").select("id,status").eq("auth_user_id",ctx.user.id).maybeSingle();
 if(clinician.error)return json({error:"Unable to read clinician"},500);
 if(!clinician.data || !["pending","verified"].includes(clinician.data.status))return json({error:"Active clinician profile required"},403);
 const result=await ctx.client.rpc("clinician_patient_share_list");
 return result.error?json({error:"Unable to read patients"},500):json({shares:result.data});
}
