import { jwtVerify } from "jose";
import { JWT_SECRET } from "../config.js";
import { sessionQueries } from "../db/index.js";

const jwtSecretKey = new TextEncoder().encode(JWT_SECRET);

// Verify token helper
export async function verifyToken(token: string) {
  try {
    // Check if session exists and is valid
    const session = sessionQueries.findByToken.get(token) as any;
    if (!session) {
      return null;
    }

    // Check if session is expired
    if (new Date(session.expires_at) < new Date()) {
      sessionQueries.deleteByToken.run(token);
      return null;
    }

    // Verify JWT
    const { payload } = await jwtVerify(token, jwtSecretKey);
    return payload;
  } catch {
    return null;
  }
}

export interface UserContext {
  userId: number;
  username: string;
  isAdmin: boolean;
  exp: number;
}

// Auth middleware - requires valid token
export const authMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({ error: "Invalid or expired token" }, 401);
  }

  c.set("user", payload);
  await next();
};

// Admin middleware - requires valid token AND admin role
export const adminMiddleware = async (c: any, next: any) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token);

  if (!payload || !payload.isAdmin) {
    return c.json({ error: "Admin access required" }, 403);
  }

  c.set("user", payload);
  await next();
};
