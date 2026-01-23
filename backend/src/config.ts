import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

// Read secrets from Docker secrets or fallback to env vars
function getSecret(secretName: string, envVar: string): string {
  try {
    // Try to read from Docker secrets first
    const secretPath = `/run/secrets/${secretName}`;
    const secret = fs.readFileSync(secretPath, "utf-8").trim();
    if (secret) {
      console.log(`✓ Loaded ${secretName} from Docker secrets`);
      return secret;
    }
  } catch (error) {
    // Docker secret not available, try environment variable
    console.log(
      `ℹ Docker secret ${secretName} not found, using environment variable`,
    );
  }

  const envValue = process.env[envVar];
  if (!envValue) {
    throw new Error(
      `Missing required secret: ${secretName} (or env var ${envVar})`,
    );
  }
  return envValue;
}

// Load secrets
export const JWT_SECRET = getSecret("jwt_secret", "JWT_SECRET");
export const ENCRYPTION_KEY = getSecret("encryption_key", "ENCRYPTION_KEY");

// Validate encryption key length (must be 32 bytes for AES-256)
if (Buffer.from(ENCRYPTION_KEY, "hex").length !== 32) {
  throw new Error(
    "ENCRYPTION_KEY must be exactly 64 hexadecimal characters (32 bytes)",
  );
}

console.log("✓ Configuration loaded successfully");
