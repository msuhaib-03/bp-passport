export interface SessionClaims {
  sessionId: string | null;
  expiresAt: string | null;
}

/**
 * Read non-authoritative metadata from a JWT that has already been verified by
 * Supabase Auth. This helper never verifies a token and must not be used before
 * `auth.getUser()` succeeds.
 */
export function sessionClaimsFromVerifiedToken(token: string): SessionClaims {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return { sessionId: null, expiresAt: null };
    const payload = JSON.parse(Buffer.from(payloadPart, "base64url").toString("utf8")) as {
      session_id?: unknown;
      exp?: unknown;
    };
    const sessionId = typeof payload.session_id === "string" && /^[0-9a-f-]{36}$/i.test(payload.session_id)
      ? payload.session_id
      : null;
    const expiresAt = typeof payload.exp === "number" && Number.isFinite(payload.exp)
      ? new Date(payload.exp * 1000).toISOString()
      : null;
    return { sessionId, expiresAt };
  } catch {
    return { sessionId: null, expiresAt: null };
  }
}
