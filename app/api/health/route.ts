import { NextResponse } from "next/server";
import { corsOptions, withCors } from "@/lib/api/cors";

export const dynamic = "force-dynamic";

export function OPTIONS() {
  return corsOptions();
}

export function GET() {
  const configured = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return withCors(NextResponse.json({
    status: "ok",
    service: "bp-passport-api",
    databaseConfigured: configured,
  }));
}
