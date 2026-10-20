import { NextResponse } from "next/server";
import { bearerToken, createAuthenticatedServerClient } from "@/lib/supabase/server";
import { withCors } from "./cors";

export function json(data: unknown, status = 200) {
  const response = withCors(NextResponse.json(data, { status }));
  response.headers.set("Cache-Control", "no-store");
  return response;
}
export async function authenticate(request: Request) {
  const token = bearerToken(request);
  if (!token) return { error: json({ error: "Authentication required" }, 401) } as const;
  const client = createAuthenticatedServerClient(token);
  if (!client) return { error: json({ error: "Supabase is not configured" }, 503) } as const;
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return { error: json({ error: "Invalid session" }, 401) } as const;
  return { client, user: data.user } as const;
}
export async function patientContext(request: Request) {
  const auth = await authenticate(request);
  if (auth.error) return auth;
  const patient = await auth.client.from("patients").select("id").eq("auth_user_id", auth.user.id).maybeSingle();
  if (patient.error) return { error: json({ error: "Unable to read patient" }, 500) } as const;
  if (!patient.data) return { error: json({ error: "Passport not found" }, 404) } as const;
  return { ...auth, patientId: patient.data.id as string } as const;
}
