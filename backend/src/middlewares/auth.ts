import { jwtVerify } from "jose";
import { JWT_SECRET } from "../config.js";
import {
  apiKeyQueries,
  memberQueries,
  sessionQueries,
  userQueries,
} from "../db/index.js";
import { ApiKeyContext, AuthContext, UserJWTPayload } from "./auth.types.js";
import { bearerAuth } from "hono/bearer-auth";
import { createHash } from "crypto";
import type { Context, MiddlewareHandler, Next } from "hono";

const jwtSecretKey = new TextEncoder().encode(JWT_SECRET);

// Verify token helper
export async function verifyToken(
  token: string,
): Promise<UserJWTPayload | null> {
  try {
    // Check if session exists and is valid
    const session = sessionQueries.findByToken.get(token);
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      sessionQueries.deleteByToken.run(token);
      return null;
    }

    const { payload }: { payload: UserJWTPayload } = await jwtVerify(
      token,
      jwtSecretKey,
    );

    // Reject banned users
    const dbUser = userQueries.findById.get(payload.userId);
    if (!dbUser || dbUser.is_banned === 1) {
      sessionQueries.deleteByToken.run(token);
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

export const authMiddleware = bearerAuth<{ Variables: { user: AuthContext } }>({
  verifyToken: async (token, c) => {
    const payload = await verifyToken(token);

    if (!payload) {
      return false;
    }

    c.set("user", payload);
    return true;
  },
});

export const adminMiddleware = bearerAuth<{ Variables: { user: AuthContext } }>(
  {
    verifyToken: async (token, c) => {
      const payload = await verifyToken(token);

      if (!payload || !payload.isAdmin) {
        return false;
      }

      c.set("user", payload);
      return true;
    },
  },
);

/**
 * Combined auth middleware: accepts both JWT tokens and API keys (plm_...).
 * For API keys, validates the key hash, expiry, and org membership via X-Org-Id header.
 * Sets c.get("user") in both cases with a compatible shape.
 */
export const combinedAuthMiddleware: MiddlewareHandler = async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token = authHeader?.replace("Bearer ", "") || "";

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // API key path
  if (token.startsWith("plm_")) {
    const hash = createHash("sha256").update(token).digest("hex");
    const apiKey = apiKeyQueries.findByHash.get(hash);

    if (!apiKey) {
      return c.json({ error: "Invalid API key" }, 401);
    }

    // Check expiry
    if (apiKey.expires_at && new Date(apiKey.expires_at) < new Date()) {
      return c.json({ error: "API key has expired" }, 401);
    }

    // Resolve org from header
    const orgIdHeader = c.req.header("X-Org-Id");
    if (!orgIdHeader) {
      return c.json(
        { error: "X-Org-Id header is required for API key authentication" },
        400,
      );
    }
    const orgId = parseInt(orgIdHeader, 10);
    if (isNaN(orgId)) {
      return c.json({ error: "Invalid X-Org-Id header" }, 400);
    }

    // Validate membership
    const membership = memberQueries.findMembership.get(orgId, apiKey.user_id);
    if (!membership) {
      return c.json(
        {
          error: "API key owner is not a member of the specified organization",
        },
        403,
      );
    }

    // Update last used (fire and forget)
    apiKeyQueries.updateLastUsed.run(apiKey.id);

    const ctx: ApiKeyContext = {
      userId: apiKey.user_id,
      username: "",
      isAdmin: false,
      currentOrgId: orgId,
      orgRole: membership.role,
      exp: 0,
      isApiKey: true,
      permissions: JSON.parse(apiKey.permissions) as string[],
    };
    c.set("user", ctx);
    await next();
    return;
  }

  // JWT path
  const payload = await verifyToken(token);
  if (!payload) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  c.set("user", payload);
  await next();
};

/**
 * Middleware factory that checks a single permission for API keys.
 * JWT-authenticated requests always pass through.
 */
export function requirePermission(permission: string): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get("user") as UserJWTPayload | ApiKeyContext;
    if (!user.isApiKey) {
      await next();
      return;
    }
    if (!user.permissions.includes(permission)) {
      return c.json(
        { error: `API key requires the '${permission}' permission` },
        403,
      );
    }
    await next();
  };
}

/**
 * Middleware factory that passes if the API key has ANY of the given permissions.
 * JWT-authenticated requests always pass through.
 */
export function requireAnyPermission(permissions: string[]): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get("user") as UserJWTPayload | ApiKeyContext;
    if (!user.isApiKey) {
      await next();
      return;
    }
    const hasAny = permissions.some((p) => user.permissions.includes(p));
    if (!hasAny) {
      return c.json(
        { error: `API key requires one of: ${permissions.join(", ")}` },
        403,
      );
    }
    await next();
  };
}
