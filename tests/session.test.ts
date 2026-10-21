import { describe, expect, it } from "vitest";

import { sessionClaimsFromVerifiedToken } from "@/lib/api/session";

function token(payload: object) {
  return `header.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.signature`;
}

describe("verified session claim parsing", () => {
  it("extracts the Supabase session id and access-token expiry", () => {
    expect(sessionClaimsFromVerifiedToken(token({
      session_id: "550e8400-e29b-41d4-a716-446655440000",
      exp: 1_893_456_000,
    }))).toEqual({
      sessionId: "550e8400-e29b-41d4-a716-446655440000",
      expiresAt: "2030-01-01T00:00:00.000Z",
    });
  });

  it("does not trust malformed claim metadata", () => {
    expect(sessionClaimsFromVerifiedToken("not-a-jwt")).toEqual({
      sessionId: null,
      expiresAt: null,
    });
    expect(sessionClaimsFromVerifiedToken(token({ session_id: "not-a-uuid", exp: "later" }))).toEqual({
      sessionId: null,
      expiresAt: null,
    });
  });
});
