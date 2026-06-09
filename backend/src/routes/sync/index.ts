import { Hono } from "hono";
import type { Context } from "hono";
import * as z from "zod";
import { randomBytes } from "crypto";
import { authMiddleware } from "../../middlewares/auth.js";
import {
  memberQueries,
  syncConfigQueries,
  syncLogQueries,
} from "../../db/index.js";
import {
  encryptCredentials,
  decryptCredentials,
  runSync,
  scheduleSync,
  cancelSchedule,
  buildProvider,
} from "../../utils/sync/index.js";
import type { UserJWTPayload } from "../../middlewares/auth.types.js";
import type {
  SyncProviderType,
  GDriveCredentials,
  DropboxCredentials,
  OneDriveCredentials,
} from "../../utils/sync/provider.js";
import { APP_URL } from "../../config.js";

type Variables = { user: UserJWTPayload };

const syncRouter = new Hono<{ Variables: Variables }>();
syncRouter.use("*", authMiddleware);

// ── Validation schemas ──────────────────────────────────────────────────────

const s3CredentialsSchema = z.object({
  accessKeyId: z.string().min(1),
  secretAccessKey: z.string().min(1),
  bucket: z.string().min(1),
  region: z.string().min(1),
  endpoint: z.string().optional(),
});

const dropboxCredentialsSchema = z.object({
  appKey: z.string().min(1),
  appSecret: z.string().min(1),
  accessToken: z.string().default(""),
  refreshToken: z.string().default(""),
});

const gdriveCredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  accessToken: z.string().default(""),
  refreshToken: z.string().default(""),
  folderId: z.string().optional(),
});

const onedriveCredentialsSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  tenantId: z.string().min(1),
  accessToken: z.string().default(""),
  refreshToken: z.string().default(""),
  folderId: z.string().optional(),
});

const saveSyncConfigSchema = z.object({
  provider: z.enum(["s3", "s3-compatible", "dropbox", "gdrive", "onedrive"]),
  credentials: z.record(z.string(), z.unknown()),
  enabled: z.boolean().optional().default(true),
  schedule: z
    .enum(["manual", "0 * * * *", "0 */6 * * *", "0 0 * * *"])
    .optional()
    .default("manual"),
  remotePrefix: z.string().optional().default(""),
});

const SCHEDULE_LABELS: Record<string, string> = {
  manual: "Manual only",
  "0 * * * *": "Hourly",
  "0 */6 * * *": "Every 6 hours",
  "0 0 * * *": "Daily",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

type SyncContext = Context<{ Variables: Variables }>;

function requireOrgAdmin(c: SyncContext) {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400 as const);
  }
  const membership = memberQueries.isAdmin.get(user.currentOrgId, user.userId);
  if (!membership || membership.count === 0) {
    return c.json(
      { error: "Forbidden: organization admin required" },
      403 as const,
    );
  }
  return null;
}

function maskCredentials(
  provider: string,
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const masked: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    if (
      key === "secretAccessKey" ||
      key === "appSecret" ||
      key === "clientSecret" ||
      key === "accessToken" ||
      key === "refreshToken"
    ) {
      masked[key] =
        typeof value === "string" && value.length > 4
          ? `${"*".repeat(value.length - 4)}${(value as string).slice(-4)}`
          : "****";
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

// ── Routes ───────────────────────────────────────────────────────────────────

// GET /api/sync/config — return current sync config (credentials masked)
syncRouter.get("/config", (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  const config = syncConfigQueries.findByOrg.get(user.currentOrgId);
  if (!config) {
    return c.json({ config: null });
  }

  let maskedCredentials: Record<string, unknown> = {};
  try {
    const raw = decryptCredentials(
      config.credentials_encrypted,
    ) as unknown as Record<string, unknown>;
    maskedCredentials = maskCredentials(config.provider, raw);
  } catch {
    maskedCredentials = {};
  }

  return c.json({
    config: {
      provider: config.provider,
      enabled: config.enabled === 1,
      schedule: config.schedule,
      scheduleLabel: SCHEDULE_LABELS[config.schedule] ?? config.schedule,
      remotePrefix: config.remote_prefix,
      lastSyncAt: config.last_sync_at,
      credentials: maskedCredentials,
    },
  });
});

// POST /api/sync/config — save (create or update) sync config
syncRouter.post("/config", async (c) => {
  const authError = requireOrgAdmin(c);
  if (authError) return authError;

  const user = c.get("user");
  const body = await c.req.json();
  const parsed = saveSyncConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid input", details: parsed.error.issues },
      400,
    );
  }

  const { provider, credentials, enabled, schedule, remotePrefix } =
    parsed.data;

  // Validate credential shape per provider
  let credParsed;
  switch (provider) {
    case "s3":
    case "s3-compatible":
      credParsed = s3CredentialsSchema.safeParse(credentials);
      break;
    case "dropbox":
      credParsed = dropboxCredentialsSchema.safeParse(credentials);
      break;
    case "gdrive":
      credParsed = gdriveCredentialsSchema.safeParse(credentials);
      break;
    case "onedrive":
      credParsed = onedriveCredentialsSchema.safeParse(credentials);
      break;
  }

  if (!credParsed!.success) {
    return c.json(
      {
        error: "Invalid credentials for provider",
        details: credParsed!.error.issues,
      },
      400,
    );
  }

  const encryptedCreds = encryptCredentials(
    credParsed!
      .data as unknown as import("../../utils/sync/provider.js").ProviderCredentials,
  );
  syncConfigQueries.upsert.run(
    user.currentOrgId!,
    provider,
    encryptedCreds,
    enabled ? 1 : 0,
    schedule,
    remotePrefix,
  );

  // Update scheduler
  if (enabled) {
    scheduleSync(user.currentOrgId!, schedule);
  } else {
    cancelSchedule(user.currentOrgId!);
  }

  return c.json({ message: "Sync configuration saved" }, 200);
});

// DELETE /api/sync/config — remove sync config
syncRouter.delete("/config", (c) => {
  const authError = requireOrgAdmin(c);
  if (authError) return authError;

  const user = c.get("user");
  cancelSchedule(user.currentOrgId!);
  syncConfigQueries.deleteByOrg.run(user.currentOrgId!);
  return c.json({ message: "Sync configuration removed" });
});

// POST /api/sync/trigger — manually kick off a sync (async, 202)
syncRouter.post("/trigger", async (c) => {
  const authError = requireOrgAdmin(c);
  if (authError) return authError;

  const user = c.get("user");
  const config = syncConfigQueries.findByOrg.get(user.currentOrgId!);
  if (!config) {
    return c.json({ error: "No sync configuration found" }, 404);
  }

  // Fire-and-forget
  void runSync(user.currentOrgId!);

  return c.json({ message: "Sync started" }, 202);
});

// POST /api/sync/test — test the connection without saving
syncRouter.post("/test", async (c) => {
  const authError = requireOrgAdmin(c);
  if (authError) return authError;

  const body = await c.req.json();
  const parsed = saveSyncConfigSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid input", details: parsed.error.issues },
      400,
    );
  }

  const { provider, credentials } = parsed.data;

  let credParsed;
  switch (provider) {
    case "s3":
    case "s3-compatible":
      credParsed = s3CredentialsSchema.safeParse(credentials);
      break;
    case "dropbox":
      credParsed = dropboxCredentialsSchema.safeParse(credentials);
      break;
    case "gdrive":
      credParsed = gdriveCredentialsSchema.safeParse(credentials);
      break;
    case "onedrive":
      credParsed = onedriveCredentialsSchema.safeParse(credentials);
      break;
  }

  if (!credParsed!.success) {
    return c.json({ error: "Invalid credentials for provider" }, 400);
  }

  try {
    const syncProvider = buildProvider(
      provider as SyncProviderType,
      credParsed!
        .data as unknown as import("../../utils/sync/provider.js").ProviderCredentials,
    );
    await syncProvider.testConnection();
    return c.json({ message: "Connection successful" });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: `Connection failed: ${message}` }, 400);
  }
});

// GET /api/sync/status — last sync log entry
syncRouter.get("/status", (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  const config = syncConfigQueries.findByOrg.get(user.currentOrgId);
  const lastLog = syncLogQueries.lastByOrg.get(user.currentOrgId);

  return c.json({
    configured: !!config,
    enabled: config ? config.enabled === 1 : false,
    schedule: config?.schedule ?? null,
    scheduleLabel: config
      ? (SCHEDULE_LABELS[config.schedule] ?? config.schedule)
      : null,
    lastSyncAt: config?.last_sync_at ?? null,
    lastLog: lastLog ?? null,
  });
});

// GET /api/sync/log — paginated sync history
syncRouter.get("/log", (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  const limitStr = c.req.query("limit");
  const limit = Math.min(parseInt(limitStr ?? "20", 10), 100);
  const logs = syncLogQueries.listByOrg.all(user.currentOrgId, limit);
  return c.json({ logs });
});

// ── OAuth flow ───────────────────────────────────────────────────────────────

interface OAuthState {
  orgId: number;
  provider: "gdrive" | "dropbox" | "onedrive";
  clientId: string;
  clientSecret: string;
  folderId?: string;
  tenantId?: string;
  schedule: string;
  remotePrefix: string;
  enabled: boolean;
  expiresAt: number;
}

const oauthStates = new Map<string, OAuthState>();

function cleanExpiredStates() {
  const now = Date.now();
  for (const [key, state] of oauthStates) {
    if (state.expiresAt < now) oauthStates.delete(key);
  }
}

const oauthConnectSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  folderId: z.string().optional(),
  tenantId: z.string().optional(),
  schedule: z
    .enum(["manual", "0 * * * *", "0 */6 * * *", "0 0 * * *"])
    .optional()
    .default("manual"),
  remotePrefix: z.string().optional().default(""),
  enabled: z.boolean().optional().default(true),
});

// POST /api/sync/oauth/connect/:provider — initiate OAuth flow (protected)
syncRouter.post("/oauth/connect/:provider", async (c) => {
  const authError = requireOrgAdmin(c);
  if (authError) return authError;

  const user = c.get("user");
  const provider = c.req.param("provider") as "gdrive" | "dropbox" | "onedrive";

  if (!["gdrive", "dropbox", "onedrive"].includes(provider)) {
    return c.json({ error: "Provider does not support OAuth" }, 400);
  }

  const body = await c.req.json();
  const parsed = oauthConnectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid input", details: parsed.error.issues },
      400,
    );
  }

  cleanExpiredStates();

  const state = randomBytes(32).toString("hex");
  const redirectUri = `${APP_URL}/api/sync/oauth/callback/${provider}`;

  oauthStates.set(state, {
    orgId: user.currentOrgId!,
    provider,
    clientId: parsed.data.clientId,
    clientSecret: parsed.data.clientSecret,
    folderId: parsed.data.folderId,
    tenantId: parsed.data.tenantId,
    schedule: parsed.data.schedule,
    remotePrefix: parsed.data.remotePrefix,
    enabled: parsed.data.enabled,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  let authUrl: string;
  switch (provider) {
    case "gdrive": {
      const params = new URLSearchParams({
        client_id: parsed.data.clientId,
        redirect_uri: redirectUri,
        scope: "https://www.googleapis.com/auth/drive",
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        state,
      });
      authUrl = `https://accounts.google.com/o/oauth2/auth?${params.toString()}`;
      break;
    }
    case "dropbox": {
      const params = new URLSearchParams({
        client_id: parsed.data.clientId,
        response_type: "code",
        redirect_uri: redirectUri,
        token_access_type: "offline",
        state,
      });
      authUrl = `https://www.dropbox.com/oauth2/authorize?${params.toString()}`;
      break;
    }
    case "onedrive": {
      const tenantId = parsed.data.tenantId ?? "common";
      const params = new URLSearchParams({
        client_id: parsed.data.clientId,
        scope: "https://graph.microsoft.com/Files.ReadWrite offline_access",
        response_type: "code",
        redirect_uri: redirectUri,
        state,
      });
      authUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/authorize?${params.toString()}`;
      break;
    }
  }

  return c.json({ authUrl });
});

// ── Public OAuth callback router (no auth — browser redirect from provider) ──
export const oauthCallbackRouter = new Hono();

oauthCallbackRouter.get("/:provider", async (c) => {
  const provider = c.req.param("provider");
  const code = c.req.query("code");
  const state = c.req.query("state");
  const oauthError = c.req.query("error");

  const settingsUrl = `${APP_URL}/settings`;

  if (oauthError || !code || !state) {
    const msg = encodeURIComponent(oauthError ?? "Authorization denied");
    return c.redirect(`${settingsUrl}?sync_error=${msg}`);
  }

  const stateData = oauthStates.get(state);
  if (!stateData || stateData.expiresAt < Date.now()) {
    oauthStates.delete(state);
    return c.redirect(
      `${settingsUrl}?sync_error=${encodeURIComponent("OAuth state expired. Please try again.")}`,
    );
  }

  oauthStates.delete(state);

  const redirectUri = `${APP_URL}/api/sync/oauth/callback/${provider}`;

  try {
    let credentials:
      | GDriveCredentials
      | DropboxCredentials
      | OneDriveCredentials;

    switch (provider) {
      case "gdrive": {
        const params = new URLSearchParams({
          code,
          client_id: stateData.clientId,
          client_secret: stateData.clientSecret,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        });
        const res = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: params.toString(),
        });
        const data = (await res.json()) as {
          access_token?: string;
          refresh_token?: string;
          error?: string;
        };
        if (!res.ok || data.error) {
          throw new Error(data.error ?? "Token exchange failed");
        }
        credentials = {
          clientId: stateData.clientId,
          clientSecret: stateData.clientSecret,
          accessToken: data.access_token!,
          refreshToken: data.refresh_token!,
          folderId: stateData.folderId,
        };
        break;
      }
      case "dropbox": {
        const params = new URLSearchParams({
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        });
        const basicAuth = Buffer.from(
          `${stateData.clientId}:${stateData.clientSecret}`,
        ).toString("base64");
        const res = await fetch("https://api.dropbox.com/oauth2/token", {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            Authorization: `Basic ${basicAuth}`,
          },
          body: params.toString(),
        });
        const data = (await res.json()) as {
          access_token?: string;
          refresh_token?: string;
          error?: string;
          error_description?: string;
        };
        if (!res.ok || data.error) {
          throw new Error(
            data.error_description ?? data.error ?? "Token exchange failed",
          );
        }
        credentials = {
          appKey: stateData.clientId,
          appSecret: stateData.clientSecret,
          accessToken: data.access_token!,
          refreshToken: data.refresh_token!,
        };
        break;
      }
      case "onedrive": {
        const tenantId = stateData.tenantId ?? "common";
        const params = new URLSearchParams({
          client_id: stateData.clientId,
          client_secret: stateData.clientSecret,
          code,
          redirect_uri: redirectUri,
          grant_type: "authorization_code",
        });
        const res = await fetch(
          `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
          {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: params.toString(),
          },
        );
        const data = (await res.json()) as {
          access_token?: string;
          refresh_token?: string;
          error?: string;
          error_description?: string;
        };
        if (!res.ok || data.error) {
          throw new Error(
            data.error_description ?? data.error ?? "Token exchange failed",
          );
        }
        credentials = {
          clientId: stateData.clientId,
          clientSecret: stateData.clientSecret,
          tenantId,
          accessToken: data.access_token!,
          refreshToken: data.refresh_token!,
          folderId: stateData.folderId,
        };
        break;
      }
      default:
        return c.redirect(
          `${settingsUrl}?sync_error=${encodeURIComponent("Unknown provider")}`,
        );
    }

    const encryptedCreds = encryptCredentials(
      credentials as import("../../utils/sync/provider.js").ProviderCredentials,
    );
    syncConfigQueries.upsert.run(
      stateData.orgId,
      provider,
      encryptedCreds,
      stateData.enabled ? 1 : 0,
      stateData.schedule,
      stateData.remotePrefix,
    );

    if (stateData.enabled) {
      scheduleSync(stateData.orgId, stateData.schedule);
    }

    return c.redirect(`${settingsUrl}?sync_connected=${provider}`);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "OAuth failed";
    return c.redirect(
      `${settingsUrl}?sync_error=${encodeURIComponent(message)}`,
    );
  }
});

export { syncRouter };
