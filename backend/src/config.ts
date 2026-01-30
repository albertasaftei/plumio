import dotenv from "dotenv";

dotenv.config();

export const JWT_SECRET = process.env.JWT_SECRET || "";
export const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "";
export const ENABLE_ENCRYPTION = process.env.ENABLE_ENCRYPTION === "true";

// Validate encryption key length (must be 32 bytes for AES-256) if encryption is enabled
if (ENABLE_ENCRYPTION && Buffer.from(ENCRYPTION_KEY, "hex").length !== 32) {
  throw new Error(
    "ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)",
  );
}

if (ENABLE_ENCRYPTION) {
  console.log("✅ Configuration loaded successfully (encryption enabled)");
} else {
  console.log("⚠️  Configuration loaded (encryption disabled)");
}
