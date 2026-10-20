import { timingSafeEqual } from "node:crypto";

export function hasAdminAccess(request: Request): boolean {
  const expected = process.env.ADMIN_TOKEN;
  const received = request.headers.get("x-admin-token");
  if (!expected || expected.length < 32 || !received) return false;

  const expectedBytes = Buffer.from(expected, "utf8");
  const receivedBytes = Buffer.from(received, "utf8");
  return expectedBytes.length === receivedBytes.length
    && timingSafeEqual(expectedBytes, receivedBytes);
}
