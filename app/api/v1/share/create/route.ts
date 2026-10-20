import { z } from "zod";
import { patientContext, json } from "@/lib/api/context";
import { newShareToken, shareHash } from "@/lib/api/share-token";
export { corsOptions as OPTIONS } from "@/lib/api/cors";
const input=z.object({pmdcNumber:z.string().trim().regex(/^[A-Za-z0-9/-]{4,24}$/)}).strict();
export async function POST(request:Request){
 const ctx=await patientContext(request); if(ctx.error)return ctx.error;
 const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return json({error:"A valid PMDC registration number is required"},400);
 let token:string, hash:string;
 try {token=newShareToken();hash=shareHash(token);}catch{return json({error:"Sharing is not configured"},503);}
 const expiresAt=new Date(Date.now()+30*86400000).toISOString();
 const result=await ctx.client.rpc("create_patient_share",{p_hash:hash,p_pmdc:parsed.data.pmdcNumber,p_expires:expiresAt});
 if(result.error || !result.data?.[0])return json({error:"Verified clinician not found, or sharing could not be created"},404);
 const share=result.data[0];
 return json({
  id:share.share_id,token,expiresAt:share.expires_at,
  clinician:{pmdcNumber:share.pmdc_number,clinicName:share.clinic_name,city:share.city},
 },201);
}
