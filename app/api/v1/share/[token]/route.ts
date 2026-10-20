import { z } from "zod";
import { patientContext, json } from "@/lib/api/context";
import { shareHash } from "@/lib/api/share-token";
export { corsOptions as OPTIONS } from "@/lib/api/cors";
export async function DELETE(request:Request,{params}:{params:Promise<{token:string}>}){
 const ctx=await patientContext(request);if(ctx.error)return ctx.error;
 const {token}=await params;
 const isId=z.string().uuid().safeParse(token).success;
 const isToken=z.string().regex(/^[A-Za-z0-9_-]{43}$/).safeParse(token).success;
 if(!isId&&!isToken)return json({error:"Invalid share identifier"},400);
 let query=ctx.client.from("patient_shares").update({revoked_at:new Date().toISOString()}).eq("patient_id",ctx.patientId);
 if(isId){query=query.eq("id",token);}else{
  let hash:string;try{hash=shareHash(token);}catch{return json({error:"Sharing is not configured"},503);}
  query=query.eq("token_hmac",hash);
 }
 const result=await query.select("id").maybeSingle();
 if(result.error)return json({error:"Unable to revoke share"},500);
 return result.data?json({revoked:true}):json({error:"Share not found"},404);
}
