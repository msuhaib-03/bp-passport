import { z } from "zod";
import { authenticate, json } from "@/lib/api/context";
import { shareHash } from "@/lib/api/share-token";
export { corsOptions as OPTIONS } from "@/lib/api/cors";
export async function GET(request:Request,{params}:{params:Promise<{token:string}>}){
 const ctx=await authenticate(request);if(ctx.error)return ctx.error;
 const {token}=await params;
 const isPatientId=z.string().uuid().safeParse(token).success;
 const isShareToken=z.string().regex(/^[A-Za-z0-9_-]{43}$/).safeParse(token).success;
 if(!isPatientId&&!isShareToken)return json({error:"Invalid share reference"},400);
 let access;
 if(isPatientId){
  access=await ctx.client.rpc("open_patient_share_by_patient",{p_patient:token});
 }else{
  let hash:string;try{hash=shareHash(token);}catch{return json({error:"Sharing is not configured"},503);}
  access=await ctx.client.rpc("open_patient_share",{p_hash:hash});
 }
 if(access.error)return json({error:"Unable to open share"},500);
 const patientId=access.data?.[0]?.patient_id;if(!patientId)return json({error:"Share not found or unavailable"},404);
 const [readings,summary]=await Promise.all([
 ctx.client.from("readings").select("systolic,diastolic,category,urgency,logged_at,taken_at_time").eq("patient_id",patientId).gte("logged_at",new Date(Date.now()-14*86400000).toISOString()).order("logged_at",{ascending:false}).limit(200),
 ctx.client.rpc("patient_bp_summary",{p_patient:patientId,p_days:14})]);
 if(readings.error||summary.error)return json({error:"Unable to read shared passport"},500);
 return json({patientId,readings:readings.data,summary:summary.data?.[0]??null});
}
