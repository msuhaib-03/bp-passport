import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const VERSION = 1;
const IV_BYTES = 12;
const TAG_BYTES = 16;

function encryptionKey(): Buffer {
  const value = process.env.PII_ENCRYPTION_KEY;
  if (!value || !/^[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error("PII_ENCRYPTION_KEY must be a 64-character hexadecimal value");
  }
  return Buffer.from(value, "hex");
}

/** AES-256-GCM envelope stored in PostgreSQL bytea as version|iv|tag|ciphertext. */
export function encryptPii(value: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const envelope = Buffer.concat([
    Buffer.from([VERSION]),
    iv,
    cipher.getAuthTag(),
    ciphertext,
  ]);
  return `\\x${envelope.toString("hex")}`;
}

export function decryptPii(value: string): string {
  const hex = value.startsWith("\\x") ? value.slice(2) : value;
  const envelope = Buffer.from(hex, "hex");
  if (envelope[0] !== VERSION || envelope.length <= 1 + IV_BYTES + TAG_BYTES) {
    throw new Error("Unsupported encrypted value");
  }
  const ivStart = 1;
  const tagStart = ivStart + IV_BYTES;
  const ciphertextStart = tagStart + TAG_BYTES;
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    envelope.subarray(ivStart, tagStart),
  );
  decipher.setAuthTag(envelope.subarray(tagStart, ciphertextStart));
  return Buffer.concat([
    decipher.update(envelope.subarray(ciphertextStart)),
    decipher.final(),
  ]).toString("utf8");
}
