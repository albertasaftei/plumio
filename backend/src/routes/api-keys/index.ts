import { Hono } from "hono";
import { randomBytes, createHash } from "crypto";
import { authMiddleware } from "../../middlewares/auth.js";
import { apiKeyQueries } from "../../db/index.js";
import { UserJWTPayload } from "../../middlewares/auth.types.js";

type Variables = {
  user: UserJWTPayload;
};

const apiKeysRouter = new Hono<{ Variables: Variables }>();

// All API key management requires regular JWT auth — API keys cannot manage other API keys
apiKeysRouter.use("*", authMiddleware);

// GET /api/api-keys — list user's API keys (no hash, no full key)
apiKeysRouter.get("/", (c) => {
  const user = c.get("user");
  const keys = apiKeyQueries.listByUser.all(user.userId);
  const apiKeys = keys.map((k) => ({
    ...k,
    permissions: JSON.parse(k.permissions) as string[],
  }));
  return c.json({ apiKeys });
});

// POST /api/api-keys — create a new API key
apiKeysRouter.post("/", async (c) => {
  const user = c.get("user");

  let body: { name?: unknown; permissions?: unknown; expires_at?: unknown };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return c.json({ error: "Name is required" }, 400);
  }

  if (!Array.isArray(body.permissions) || body.permissions.length === 0) {
    return c.json({ error: "At least one permission is required" }, 400);
  }

  const validPermissions = [
    "documents:read",
    "documents:create",
    "documents:update",
    "documents:delete",
    "folders:read",
    "folders:create",
    "folders:update",
    "folders:delete",
    "tags:read",
    "tags:create",
    "tags:update",
    "tags:delete",
  ];
  const permissions = (body.permissions as unknown[]).filter(
    (p): p is string => typeof p === "string" && validPermissions.includes(p),
  );

  if (permissions.length === 0) {
    return c.json({ error: "No valid permissions provided" }, 400);
  }

  let expiresAt: string | null = null;
  if (
    body.expires_at !== undefined &&
    body.expires_at !== null &&
    body.expires_at !== ""
  ) {
    const parsed = new Date(body.expires_at as string);
    if (isNaN(parsed.getTime())) {
      return c.json({ error: "Invalid expires_at date" }, 400);
    }
    if (parsed <= new Date()) {
      return c.json({ error: "expires_at must be in the future" }, 400);
    }
    expiresAt = parsed.toISOString();
  }

  // Generate a cryptographically random key: plm_ + 64 hex chars
  const rawKey = "plm_" + randomBytes(32).toString("hex");
  const keyHash = createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 8); // "plm_" + 4 hex chars

  apiKeyQueries.insert.run(
    user.userId,
    name,
    keyHash,
    keyPrefix,
    JSON.stringify(permissions),
    expiresAt,
  );

  // Fetch the newly created record (without the hash)
  const all = apiKeyQueries.listByUser.all(user.userId);
  const newKey = all.find((k) => k.key_prefix === keyPrefix && k.name === name);

  return c.json(
    {
      apiKey: {
        ...newKey,
        permissions,
        key: rawKey, // Only time the full key is returned
      },
    },
    201,
  );
});

// DELETE /api/api-keys/:id — revoke an API key
apiKeysRouter.delete("/:id", (c) => {
  const user = c.get("user");
  const id = parseInt(c.req.param("id"), 10);
  if (isNaN(id)) {
    return c.json({ error: "Invalid key ID" }, 400);
  }

  const result = apiKeyQueries.deleteById.run(id, user.userId);
  if (result.changes === 0) {
    return c.json({ error: "API key not found" }, 404);
  }

  return c.json({ message: "API key revoked" });
});

export { apiKeysRouter };
