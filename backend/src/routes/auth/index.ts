import { Hono } from "hono";
import { SignJWT } from "jose";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { JWT_SECRET } from "../../config.js";
import {
  userQueries,
  sessionQueries,
  organizationQueries,
  memberQueries,
  settingsQueries,
  passwordResetQueries,
  emailChangeQueries,
} from "../../db/index.js";
import { UserJWTPayload } from "../../middlewares/auth.types.js";
import { authMiddleware } from "../../middlewares/auth.js";
import * as z from "zod";
import {
  loginSchema,
  registerSchema,
  updateProfileSchema,
} from "./helpers/schemas.js";
import {
  sendPasswordResetEmail,
  sendEmailChangeConfirmationEmail,
} from "../../utils/email.js";
import { SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM } from "../../config.js";

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
      const resolvedOrgName = `${username}'s Organization`;
      const orgResult = organizationQueries.create.run(
        resolvedOrgName,
        orgSlug,
        userId,
        0, // personal orgs are not discoverable
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

// Login
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

    // Use personal organization as default (the one owned by the user), fallback to first
    const currentOrg =
      organizations.find((o) => o.owner_id === user.id) || organizations[0];
    const membership = memberQueries.findMembership.get(currentOrg.id, user.id);

    // Check if user is global admin
    const isGlobalAdmin = user.is_admin === 1;

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

    // Check runtime setting — registration may be disabled by admin
    const registrationSetting = settingsQueries.get.get("registration_enabled");
    if (registrationSetting?.value === "false") {
      return c.json({ error: "Registration is currently disabled." }, 403);
    }

    const parsed = registerSchema.safeParse(await c.req.json());

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
      const resolvedOrgName = `${username}'s Organization`;
      const orgResult = organizationQueries.create.run(
        resolvedOrgName,
        orgSlug,
        userId,
        0, // personal orgs are not discoverable
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

// Update own profile
authRouter.put("/profile", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const parsed = updateProfileSchema.safeParse(await c.req.json());

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    const { username } = parsed.data;

    // Check if username is already taken by another user
    const existing = userQueries.findByUsername.get(username);
    if (existing && existing.id !== user.userId) {
      return c.json({ error: "Username is already taken" }, 400);
    }

    userQueries.updateUsername.run(username, user.userId);

    // Issue a fresh JWT with the updated username
    const authHeader = c.req.header("Authorization");
    const oldToken = authHeader!.substring(7);
    const session = sessionQueries.findByToken.get(oldToken);

    const newToken = await new SignJWT({
      userId: user.userId,
      username,
      isAdmin: user.isAdmin,
      currentOrgId: user.currentOrgId,
      orgRole: user.orgRole,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(jwtSecretKey);

    if (session) {
      const expiresAt = new Date(
        Date.now() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString();
      sessionQueries.deleteByToken.run(oldToken);
      sessionQueries.create.run(
        session.id,
        user.userId,
        newToken,
        user.currentOrgId ?? null,
        expiresAt,
      );
    }

    return c.json({ message: "Profile updated successfully", token: newToken });
  } catch (error) {
    console.error("Profile update error:", error);
    return c.json({ error: "Failed to update profile" }, 500);
  }
});

// Change password (authenticated user changing their own password)
authRouter.put("/change-password", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const currentPassword =
      typeof body?.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      return c.json(
        { error: "Current password and new password are required" },
        400,
      );
    }

    if (newPassword.length < 8) {
      return c.json(
        { error: "New password must be at least 8 characters" },
        400,
      );
    }

    const dbUser = userQueries.findById.get(user.userId);
    if (!dbUser) {
      return c.json({ error: "User not found" }, 404);
    }

    const passwordMatch = await bcrypt.compare(
      currentPassword,
      dbUser.password_hash,
    );
    if (!passwordMatch) {
      return c.json({ error: "Current password is incorrect" }, 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    userQueries.updatePassword.run(passwordHash, user.userId);

    return c.json({ message: "Password changed successfully" });
  } catch (error) {
    console.error("Change password error:", error);
    return c.json({ error: "Failed to change password" }, 500);
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

// Forgot password - send reset email
authRouter.post("/forgot-password", async (c) => {
  try {
    // Check SMTP config first
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      return c.json({ error: "Email service is not configured" }, 503);
    }

    const body = await c.req.json().catch(() => ({}));
    const email = typeof body?.email === "string" ? body.email.trim() : "";

    if (!email) {
      return c.json({ error: "Email is required" }, 400);
    }

    // Always return 200 to prevent email enumeration
    const user = userQueries.findByEmail.get(email);
    if (!user) {
      return c.json({
        message: "If that email exists, a reset link has been sent.",
      });
    }

    // Delete any existing (unused or expired) tokens for this user
    passwordResetQueries.deleteByUserId.run(user.id);

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    passwordResetQueries.create.run(user.id, token, expiresAt);

    await sendPasswordResetEmail(user.email, token);

    return c.json({
      message: "If that email exists, a reset link has been sent.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return c.json({ error: "Failed to send reset email" }, 500);
  }
});

// Reset password - consume token and update password
authRouter.post("/reset-password", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";
    const newPassword =
      typeof body?.newPassword === "string" ? body.newPassword : "";

    if (!token || !newPassword) {
      return c.json({ error: "Token and new password are required" }, 400);
    }

    if (newPassword.length < 8) {
      return c.json({ error: "Password must be at least 8 characters" }, 400);
    }

    const resetToken = passwordResetQueries.findByToken.get(token);

    if (!resetToken) {
      return c.json({ error: "Invalid or expired reset token" }, 400);
    }

    if (resetToken.used === 1) {
      return c.json({ error: "Reset token has already been used" }, 400);
    }

    if (new Date(resetToken.expires_at) < new Date()) {
      return c.json({ error: "Reset token has expired" }, 400);
    }

    const passwordHash = await bcrypt.hash(newPassword, 10);
    userQueries.updatePassword.run(passwordHash, resetToken.user_id);

    // Mark token as used
    passwordResetQueries.markUsed.run(token);

    // Invalidate all existing sessions for the user
    sessionQueries.deleteByUserId.run(resetToken.user_id);

    return c.json({ message: "Password reset successfully. Please log in." });
  } catch (error) {
    console.error("Reset password error:", error);
    return c.json({ error: "Failed to reset password" }, 500);
  }
});

// Get own profile (email)
authRouter.get("/profile", authMiddleware, async (c) => {
  try {
    const user = c.get("user");
    const dbUser = userQueries.findById.get(user.userId);
    if (!dbUser) {
      return c.json({ error: "User not found" }, 404);
    }
    return c.json({ email: dbUser.email });
  } catch (error) {
    console.error("Get profile error:", error);
    return c.json({ error: "Failed to get profile" }, 500);
  }
});

// Request email change - sends confirmation link to new email
authRouter.post("/request-email-change", authMiddleware, async (c) => {
  try {
    if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS || !SMTP_FROM) {
      return c.json({ error: "Email service is not configured" }, 503);
    }

    const user = c.get("user");
    const body = await c.req.json().catch(() => ({}));
    const newEmailSchema = z.string().email();
    const newEmail =
      typeof body?.newEmail === "string" ? body.newEmail.trim() : "";

    if (!newEmail) {
      return c.json({ error: "New email address is required" }, 400);
    }

    const emailParsed = newEmailSchema.safeParse(newEmail);
    if (!emailParsed.success) {
      return c.json({ error: "Invalid email address" }, 400);
    }

    // Check if email is already taken by another user
    const existing = userQueries.findByEmail.get(newEmail);
    if (existing && existing.id !== user.userId) {
      return c.json({ error: "Email address is already in use" }, 400);
    }

    // Check it's not the same as the current email
    const dbUser = userQueries.findById.get(user.userId);
    if (dbUser && dbUser.email.toLowerCase() === newEmail.toLowerCase()) {
      return c.json(
        { error: "New email is the same as your current email" },
        400,
      );
    }

    // Delete any existing pending tokens for this user
    emailChangeQueries.deleteByUserId.run(user.userId);

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour

    emailChangeQueries.create.run(user.userId, newEmail, token, expiresAt);

    await sendEmailChangeConfirmationEmail(newEmail, token);

    return c.json({
      message: "Confirmation email sent to your new address.",
    });
  } catch (error) {
    console.error("Request email change error:", error);
    return c.json({ error: "Failed to send confirmation email" }, 500);
  }
});

// Confirm email change - consumes token and updates email
authRouter.post("/confirm-email-change", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const token = typeof body?.token === "string" ? body.token.trim() : "";

    if (!token) {
      return c.json({ error: "Token is required" }, 400);
    }

    const changeToken = emailChangeQueries.findByToken.get(token);

    if (!changeToken) {
      return c.json({ error: "Invalid or expired confirmation token" }, 400);
    }

    if (changeToken.used === 1) {
      return c.json(
        { error: "This confirmation link has already been used" },
        400,
      );
    }

    if (new Date(changeToken.expires_at) < new Date()) {
      return c.json({ error: "Confirmation link has expired" }, 400);
    }

    // Check the new email hasn't been taken since the request was made
    const existing = userQueries.findByEmail.get(changeToken.new_email);
    if (existing && existing.id !== changeToken.user_id) {
      return c.json(
        { error: "This email address is no longer available" },
        400,
      );
    }

    userQueries.updateEmail.run(changeToken.new_email, changeToken.user_id);
    emailChangeQueries.markUsed.run(token);

    return c.json({ message: "Email updated successfully." });
  } catch (error) {
    console.error("Confirm email change error:", error);
    return c.json({ error: "Failed to confirm email change" }, 500);
  }
});

export { authRouter };
