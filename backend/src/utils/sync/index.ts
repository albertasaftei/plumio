import fs from "fs/promises";
import path from "path";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { db, syncConfigQueries, syncLogQueries } from "../../db/index.js";
import { ENCRYPTION_KEY } from "../../config.js";
import { S3Provider } from "./providers/s3.js";
import { DropboxProvider } from "./providers/dropbox.js";
import { GDriveProvider } from "./providers/gdrive.js";
import { OneDriveProvider } from "./providers/onedrive.js";
import type {
  SyncProvider,
  ProviderCredentials,
  SyncProviderType,
} from "./provider.js";
import type { SyncConfig } from "../../db/index.types.js";

const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || "./documents";
const ALGORITHM = "aes-256-gcm";

// ── Encryption helpers ─────────────────────────────────────────────────────

function encryptCredentials(credentials: ProviderCredentials): string {
  if (!ENCRYPTION_KEY) {
    // Store as plain JSON when no key is configured (development / no encryption)
    return JSON.stringify({ plain: JSON.stringify(credentials) });
  }

  const keyBuffer = Buffer.from(ENCRYPTION_KEY.replace(/=.+$/, ""), "base64");
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return JSON.stringify({
    iv: iv.toString("hex"),
    data: encrypted.toString("hex"),
    tag: tag.toString("hex"),
  });
}

function decryptCredentials(stored: string): ProviderCredentials {
  const parsed = JSON.parse(stored) as {
    plain?: string;
    iv?: string;
    data?: string;
    tag?: string;
  };

  if (parsed.plain) {
    return JSON.parse(parsed.plain) as ProviderCredentials;
  }

  if (!ENCRYPTION_KEY) {
    throw new Error("ENCRYPTION_KEY is required to decrypt stored credentials");
  }

  const keyBuffer = Buffer.from(ENCRYPTION_KEY.replace(/=.+$/, ""), "base64");
  const iv = Buffer.from(parsed.iv!, "hex");
  const encryptedData = Buffer.from(parsed.data!, "hex");
  const tag = Buffer.from(parsed.tag!, "hex");

  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encryptedData),
    decipher.final(),
  ]);
  return JSON.parse(decrypted.toString("utf8")) as ProviderCredentials;
}

// ── Provider factory ────────────────────────────────────────────────────────

export function buildProvider(
  type: SyncProviderType,
  credentials: ProviderCredentials,
): SyncProvider {
  switch (type) {
    case "s3":
    case "s3-compatible":
      return new S3Provider(
        credentials as import("./provider.js").S3Credentials,
      );
    case "dropbox":
      return new DropboxProvider(
        credentials as import("./provider.js").DropboxCredentials,
      );
    case "gdrive":
      return new GDriveProvider(
        credentials as import("./provider.js").GDriveCredentials,
      );
    case "onedrive":
      return new OneDriveProvider(
        credentials as import("./provider.js").OneDriveCredentials,
      );
    default:
      throw new Error(`Unknown sync provider: ${type as string}`);
  }
}

// ── File collection ─────────────────────────────────────────────────────────

async function collectOrgFiles(
  orgId: number,
): Promise<Array<{ localPath: string; remotePath: string }>> {
  const orgDir = path.join(DOCUMENTS_PATH, `org-${orgId}`);
  const files: Array<{ localPath: string; remotePath: string }> = [];

  async function walk(dir: string, relBase: string) {
    let entries: string[];
    try {
      entries = await fs.readdir(dir);
    } catch {
      return;
    }

    for (const name of entries) {
      const fullPath = path.join(dir, name);
      const relPath = relBase ? `${relBase}/${name}` : name;

      let stat;
      try {
        stat = await fs.stat(fullPath);
      } catch {
        continue;
      }

      if (stat.isDirectory()) {
        await walk(fullPath, relPath);
      } else if (stat.isFile()) {
        files.push({ localPath: fullPath, remotePath: relPath });
      }
    }
  }

  await walk(orgDir, "");
  return files;
}

// ── Core sync logic ─────────────────────────────────────────────────────────

export async function runSync(orgId: number): Promise<void> {
  const config = syncConfigQueries.findByOrg.get(orgId);
  if (!config || !config.enabled) {
    console.log(`[sync] No active config for org ${orgId}, skipping.`);
    return;
  }

  const logEntry = syncLogQueries.insert.get(orgId, config.provider);
  if (!logEntry) {
    console.error(`[sync] Failed to create log entry for org ${orgId}`);
    return;
  }
  const logId = logEntry.id;

  console.log(`[sync] Starting sync for org ${orgId} via ${config.provider}`);

  try {
    const credentials = decryptCredentials(config.credentials_encrypted);
    const provider = buildProvider(
      config.provider as SyncProviderType,
      credentials,
    );

    const prefix = config.remote_prefix
      ? `${config.remote_prefix.replace(/\/$/, "")}/org-${orgId}`
      : `org-${orgId}`;

    // Gather local files
    const localFiles = await collectOrgFiles(orgId);

    // Gather remote files
    const remoteFiles = await provider.list(prefix);
    const remoteSet = new Set(remoteFiles.map((f) => f.path));

    let filesUploaded = 0;
    let filesDeleted = 0;

    // Upload all local files
    for (const { localPath, remotePath } of localFiles) {
      const remoteKey = `${prefix}/${remotePath}`.replace(/\/+/g, "/");
      try {
        const content = await fs.readFile(localPath);
        await provider.upload(remoteKey, content);
        filesUploaded++;
        remoteSet.delete(remoteKey);
      } catch (uploadErr) {
        console.error(`[sync] Failed to upload ${remotePath}:`, uploadErr);
      }
    }

    // Delete remote files that no longer exist locally
    const localRemoteKeys = new Set(
      localFiles.map(({ remotePath }) =>
        `${prefix}/${remotePath}`.replace(/\/+/g, "/"),
      ),
    );
    for (const remoteFile of remoteFiles) {
      if (!localRemoteKeys.has(remoteFile.path)) {
        try {
          await provider.delete(remoteFile.path);
          filesDeleted++;
        } catch (deleteErr) {
          console.error(
            `[sync] Failed to delete remote ${remoteFile.path}:`,
            deleteErr,
          );
        }
      }
    }

    // Persist refreshed OAuth tokens if provider supports it
    if ("getCredentials" in provider) {
      const updatedCreds = (
        provider as { getCredentials(): ProviderCredentials }
      ).getCredentials();
      const reEncrypted = encryptCredentials(updatedCreds);
      syncConfigQueries.updateCredentials.run(reEncrypted, orgId);
    }

    syncConfigQueries.updateLastSync.run(orgId);
    // complete(error_msg_for_status_check, files_uploaded, error_message, log_id)
    syncLogQueries.complete.run(null, filesUploaded, null, logId);

    console.log(
      `[sync] Org ${orgId}: uploaded ${filesUploaded}, deleted ${filesDeleted}`,
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[sync] Sync failed for org ${orgId}:`, message);
    // complete(error_msg_for_status_check, files_uploaded, error_message, log_id)
    syncLogQueries.complete.run(message, 0, message, logId);
  }
}

// ── Public helpers ──────────────────────────────────────────────────────────

export { encryptCredentials, decryptCredentials };

// ── Scheduler ───────────────────────────────────────────────────────────────

const scheduledJobs = new Map<number, ReturnType<typeof setInterval>>();

const CRON_TO_MS: Record<string, number> = {
  "0 * * * *": 60 * 60 * 1000, // hourly
  "0 */6 * * *": 6 * 60 * 60 * 1000, // every 6 hours
  "0 0 * * *": 24 * 60 * 60 * 1000, // daily
};

export function scheduleSync(orgId: number, cronExpr: string): void {
  cancelSchedule(orgId);

  const intervalMs = CRON_TO_MS[cronExpr];
  if (!intervalMs) return; // "manual" or unknown — no automatic scheduling

  const job = setInterval(() => {
    void runSync(orgId);
  }, intervalMs);

  scheduledJobs.set(orgId, job);
  console.log(
    `[sync] Scheduled org ${orgId} every ${intervalMs / 60000} min (${cronExpr})`,
  );
}

export function cancelSchedule(orgId: number): void {
  const existing = scheduledJobs.get(orgId);
  if (existing) {
    clearInterval(existing);
    scheduledJobs.delete(orgId);
  }
}

export function initSyncScheduler(): void {
  if (process.env.NODE_ENV === "test") return;

  try {
    const enabledConfigs = syncConfigQueries.listEnabled.all();
    for (const config of enabledConfigs) {
      scheduleSync(config.org_id, config.schedule);
    }
    console.log(
      `✅ Sync scheduler initialized (${enabledConfigs.length} active configs)`,
    );
  } catch (err) {
    // Tables may not exist yet on a fresh install before migrations run
    console.error("[sync] Could not initialize scheduler:", err);
  }
}
