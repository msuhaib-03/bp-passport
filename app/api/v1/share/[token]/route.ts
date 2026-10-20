import { z } from "zod";
import { patientContext, json } from "@/lib/api/context";
import { shareHash } from "@/lib/api/share-token";
export { corsOptions as OPTIONS } from "@/lib/api/cors";
export async function DELETE(request:Request,{params}:{params:Promise<{token:string}>}){
 const ctx=await patientContext(request);if(ctx.error)return ctx.error;
 const {token}=await params;if(!z.string().regex(/^[A-Za-z0-9_-]{43}$/).safeParse(token).success)return json({error:"Invalid share token"},400);
 let hash:string;try{hash=shareHash(token);}catch{return json({error:"Sharing is not configured"},503);}
 const result=await ctx.client.from("patient_shares").update({revoked_at:new Date().toISOString()}).eq("patient_id",ctx.patientId).eq("token_hmac",hash).select("id").maybeSingle();
 if(result.error)return json({error:"Unable to revoke share"},500);
 return result.data?json({revoked:true}):json({error:"Share not found"},404);
}
