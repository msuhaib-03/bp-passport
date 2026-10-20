import { createHmac, randomBytes } from "node:crypto";
export function shareHash(token: string): string {
  const pepper = process.env.SHARE_TOKEN_PEPPER;
  if (!pepper || pepper.length < 32) throw new Error("SHARE_TOKEN_PEPPER must contain at least 32 characters");
  return createHmac("sha256", pepper).update(token).digest("hex");
}
export function newShareToken() { return randomBytes(32).toString("base64url"); }
