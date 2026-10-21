import { authenticate, json } from "@/lib/api/context";
import { createServiceServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const auth = await authenticate(request);
  if (auth.error) return auth.error;
  if (!auth.sessionId || !auth.expiresAt) {
    return json({ error: "This token has no revocable session identifier" }, 400);
  }

  const service = createServiceServerClient();
  if (!service) return json({ error: "Secure logout is not configured" }, 503);

  const { error } = await service.from("revoked_sessions").upsert({
    session_id: auth.sessionId,
    user_id: auth.user.id,
    expires_at: auth.expiresAt,
  }, { onConflict: "session_id" });
  if (error) return json({ error: "Unable to revoke this session" }, 500);

  return json({ revoked: true });
}
