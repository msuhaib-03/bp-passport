import { z } from "zod";
import { patientContext, json } from "@/lib/api/context";
import { newShareToken, shareHash } from "@/lib/api/share-token";
export { corsOptions as OPTIONS } from "@/lib/api/cors";
const input=z.object({clinicianId:z.string().uuid()}).strict();
export async function POST(request:Request){
 const ctx=await patientContext(request); if(ctx.error)return ctx.error;
 const parsed=input.safeParse(await request.json().catch(()=>null));
 if(!parsed.success)return json({error:"A verified clinician ID is required"},400);
 let token:string, hash:string;
 try {token=newShareToken();hash=shareHash(token);}catch{return json({error:"Sharing is not configured"},503);}
 const expiresAt=new Date(Date.now()+30*86400000).toISOString();
 const result=await ctx.client.from("patient_shares").insert({patient_id:ctx.patientId,clinician_id:parsed.data.clinicianId,token_hmac:hash,expires_at:expiresAt}).select("id,expires_at").single();
 if(result.error)return json({error:"Unable to create share"},400);
 return json({id:result.data.id,token,expiresAt:result.data.expires_at},201);
}
