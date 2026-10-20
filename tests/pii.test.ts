import { afterEach, describe, expect, it } from "vitest";

import { decryptPii, encryptPii } from "@/lib/api/pii";

const originalKey = process.env.PII_ENCRYPTION_KEY;
const testKey = "a7".repeat(32);

afterEach(() => {
  if (originalKey === undefined) delete process.env.PII_ENCRYPTION_KEY;
  else process.env.PII_ENCRYPTION_KEY = originalKey;
});

describe("PII encryption", () => {
  it("round-trips Unicode names with a randomized AES-GCM envelope", () => {
    process.env.PII_ENCRYPTION_KEY = testKey;
    const first = encryptPii("Dr Ayesha خان");
    const second = encryptPii("Dr Ayesha خان");

    expect(first).toMatch(/^\\x[0-9a-f]+$/);
    expect(second).not.toBe(first);
    expect(decryptPii(first)).toBe("Dr Ayesha خان");
    expect(decryptPii(second)).toBe("Dr Ayesha خان");
  });

  it("fails closed when the encryption key is absent or malformed", () => {
    delete process.env.PII_ENCRYPTION_KEY;
    expect(() => encryptPii("Doctor")).toThrow(/PII_ENCRYPTION_KEY/);

    process.env.PII_ENCRYPTION_KEY = "too-short";
    expect(() => encryptPii("Doctor")).toThrow(/PII_ENCRYPTION_KEY/);
  });

  it("detects tampering", () => {
    process.env.PII_ENCRYPTION_KEY = testKey;
    const encrypted = encryptPii("Doctor");
    const last = encrypted.at(-1)!;
    const tampered = `${encrypted.slice(0, -1)}${last === "0" ? "1" : "0"}`;

    expect(() => decryptPii(tampered)).toThrow();
  });
});
