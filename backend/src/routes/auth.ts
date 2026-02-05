import { Hono } from "hono";
import { SignJWT } from "jose";
import bcrypt from "bcrypt";
import { JWT_SECRET } from "../config.js";
import {
  userQueries,
  sessionQueries,
  organizationQueries,
  memberQueries,
} from "../db/index.js";
import crypto from "crypto";
import { UserJWTPayload } from "../middlewares/auth.types.js";
import { authMiddleware } from "../middlewares/auth.js";
import * as z from "zod";

type Variables = {
  user: UserJWTPayload;
};

const authRouter = new Hono<{ Variables: Variables }>();

const jwtSecretKey = new TextEncoder().encode(JWT_SECRET);

// Validate session - Check if current token is valid
authRouter.get("/validate", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    return c.json({
      valid: true,
      userId: user.userId,
      username: user.username,
    });
  } catch (error) {
    return c.json({ valid: false }, 401);
  }
});

// Setup - Create initial user (only if no users exist)
authRouter.post("/setup", async (c) => {
  try {
    // Check if any users exist
    const existingUsers = userQueries.findById.get(1);
    if (existingUsers) {
      return c.json({ error: "Setup already completed" }, 400);
    }

    const { username, email, password } = await c.req.json();

    if (!username || !email || !password || password.length < 8) {
      return c.json(
        { error: "Invalid credentials (password min 8 characters)" },
        400,
      );
    }

    const passwordHash = await bcrypt.hash(password, 10);

    try {
      // Create user
      const result = userQueries.create.run(username, email, passwordHash);
      const userId = result.lastInsertRowid as number;

      // Create personal organization
      const orgSlug = `${username}-personal`;
      const orgResult = organizationQueries.create.run(
        `${username}'s Organization`,
        orgSlug,
        userId,
      );
      const orgId = orgResult.lastInsertRowid as number;

      // Add user as admin of their organization
      memberQueries.add.run(orgId, userId, "admin");

      return c.json({ message: "Setup completed successfully" });
    } catch (error: any) {
      if (error.message.includes("UNIQUE")) {
        return c.json({ error: "Username or email already exists" }, 400);
      }
      throw error;
    }
  } catch (error) {
    console.error("Setup error:", error);
    return c.json({ error: "Setup failed" }, 500);
  }
});

const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
});

authRouter.post("/login", async (c) => {
  try {
    const parsed = loginSchema.safeParse(await c.req.json());

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }
    const { username, password } = parsed.data;

    const user = userQueries.findByUsername.get(username);

    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return c.json({ error: "Invalid credentials" }, 401);
    }

    // Get user's organizations
    const organizations = organizationQueries.listByUser.all(user.id);

    if (organizations.length === 0) {
      return c.json({ error: "No organization found for user" }, 500);
    }

    // Use first organization as default (usually personal org)
    const currentOrg = organizations[0];
    const membership = memberQueries.findMembership.get(currentOrg.id, user.id);

    // Check if user is global admin (first user)
    const isGlobalAdmin = user.id === 1;

    // Create session with organization context
    const sessionId = crypto.randomUUID();
    const token = await new SignJWT({
      userId: user.id,
      username: user.username,
      isAdmin: isGlobalAdmin,
      currentOrgId: currentOrg.id,
      orgRole: membership?.role || "member",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(jwtSecretKey);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    sessionQueries.create.run(
      sessionId,
      user.id,
      token,
      currentOrg.id,
      expiresAt.toISOString(),
    );

    return c.json({
      token,
      username: user.username,
      isAdmin: isGlobalAdmin,
      currentOrganization: {
        id: currentOrg.id,
        name: currentOrg.name,
        slug: currentOrg.slug,
        role: membership?.role || "member",
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return c.json({ error: "Login failed" }, 500);
  }
});

// Logout
authRouter.post("/logout", async (c) => {
  try {
    const authHeader = c.req.header("Authorization");
    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      sessionQueries.deleteByToken.run(token);
    }
    return c.json({ message: "Logged out successfully" });
  } catch (error) {
    console.error("Logout error:", error);
    return c.json({ error: "Logout failed" }, 500);
  }
});

const registerSchema = z.object({
  username: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
});
// Register - Create new user account
authRouter.post("/register", async (c) => {
  try {
    // Check if setup is complete (at least one user exists)
    const firstUser = userQueries.findById.get(1);
    if (!firstUser) {
      return c.json(
        { error: "System setup not completed. Please complete setup first." },
        400,
      );
    }

    const parsed = registerSchema.safeParse(await c.req.json());

    console.log({ parsed });

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    const { username, email, password } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);

    try {
      // Create user
      const result = userQueries.create.run(username, email, passwordHash);
      const userId = result.lastInsertRowid as number;

      // Create personal organization for the new user
      const orgSlug = `${username}-personal`;
      const orgResult = organizationQueries.create.run(
        `${username}'s Organization`,
        orgSlug,
        userId,
      );
      const orgId = orgResult.lastInsertRowid as number;

      // Add user as admin of their organization
      memberQueries.add.run(orgId, userId, "admin");

      return c.json({ message: "Registration successful. Please login." });
    } catch (error: any) {
      if (error.message.includes("UNIQUE")) {
        return c.json({ error: "Username or email already exists" }, 400);
      }
      throw error;
    }
  } catch (error) {
    console.error("Register error:", error);
    return c.json({ error: "Registration failed" }, 500);
  }
});

// Check if setup is needed
authRouter.get("/check-setup", async (c) => {
  try {
    const user = userQueries.findById.get(1);
    return c.json({ needsSetup: !user });
  } catch (error) {
    console.error("Check setup error:", error);
    return c.json({ needsSetup: true });
  }
});

export { authRouter };
