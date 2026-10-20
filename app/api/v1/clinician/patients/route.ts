import { authenticate, json } from "@/lib/api/context";
export { corsOptions as OPTIONS } from "@/lib/api/cors";
export async function GET(request:Request){
 const ctx=await authenticate(request);if(ctx.error)return ctx.error;
 const clinician=await ctx.client.from("clinicians").select("id,status").eq("auth_user_id",ctx.user.id).maybeSingle();
 if(clinician.error)return json({error:"Unable to read clinician"},500);
 if(clinician.data?.status!=="verified")return json({error:"Verified clinician required"},403);
 const result=await ctx.client.from("patient_shares").select("id,patient_id,expires_at,first_accessed_at").eq("clinician_id",clinician.data.id).is("revoked_at",null).gt("expires_at",new Date().toISOString()).order("created_at",{ascending:false}).limit(100);
 return result.error?json({error:"Unable to read patients"},500):json({shares:result.data});
}
