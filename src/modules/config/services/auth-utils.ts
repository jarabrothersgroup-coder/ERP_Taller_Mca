import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SALT_LENGTH = 32;

function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH);
}

export function hashPassword(password: string): string {
  const salt = randomBytes(SALT_LENGTH);
  const key = deriveKey(password, salt);
  return `${salt.toString("hex")}:${key.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;
  const salt = Buffer.from(saltHex, "hex");
  const expectedKey = Buffer.from(keyHex, "hex");
  const actualKey = deriveKey(password, salt);
  if (actualKey.length !== expectedKey.length) return false;
  return timingSafeEqual(actualKey, expectedKey);
}
