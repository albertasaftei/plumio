import crypto from "crypto";
import { ENCRYPTION_KEY, ENABLE_ENCRYPTION } from "../../../config.js";

export const encryptionKeyBuffer = ENABLE_ENCRYPTION
  ? Buffer.from(ENCRYPTION_KEY, "hex")
  : Buffer.alloc(0);

export function encrypt(text: string): string {
  if (!ENABLE_ENCRYPTION) {
    return text;
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKeyBuffer, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

export function decrypt(text: string): string {
  if (!ENABLE_ENCRYPTION) {
    return text;
  }
  const parts = text.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    encryptionKeyBuffer,
    iv,
  );
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
