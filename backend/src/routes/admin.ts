import { Hono } from "hono";
import bcrypt from "bcrypt";
import {
  userQueries,
  organizationQueries,
  memberQueries,
  settingsQueries,
} from "../db/index.js";
import { adminMiddleware } from "../middlewares/auth.js";
import { UserJWTPayload } from "../middlewares/auth.types.js";
import * as z from "zod";

const adminRouter = new Hono<{ Variables: { user: UserJWTPayload } }>();

// All admin routes require admin middleware
adminRouter.use("*", adminMiddleware);

// List all users
adminRouter.get("/users", async (c) => {
  try {
    const users = userQueries.listAll.all();
    const userList = users.map((user) => ({
      id: user.id,
      username: user.username,
      email: user.email,
      createdAt: user.created_at,
      isAdmin: user.is_admin === 1,
    }));
    return c.json({ users: userList });
  } catch (error) {
    console.error("Error listing users:", error);
    return c.json({ error: "Failed to list users" }, 500);
  }
});

const registerSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  isAdmin: z.boolean().optional().default(false),
});
// Create new user
adminRouter.post("/users", async (c) => {
  try {
    const parsed = registerSchema.safeParse(await c.req.json());

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    const { username, email, password, isAdmin } = parsed.data;
    const passwordHash = await bcrypt.hash(password, 10);

    try {
      // Create user
      const result = userQueries.create.run(username, email, passwordHash);
      const userId = result.lastInsertRowid as number;

      // Set admin flag if requested
      if (isAdmin) {
        userQueries.setAdmin.run(1, userId);
      }

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

      return c.json({ message: "User created successfully" });
    } catch (error: any) {
      if (error.message.includes("UNIQUE")) {
        return c.json({ error: "Username or email already exists" }, 400);
      }
      throw error;
    }
  } catch (error) {
    console.error("Error creating user:", error);
    return c.json({ error: "Failed to create user" }, 500);
  }
});

const updateUserParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});

const updateUserSchema = z.object({
  isAdmin: z.boolean(),
});

// Update user admin status
adminRouter.put("/users/:id", async (c) => {
  try {
    const parsedParams = updateUserParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!parsedParams.success) {
      return c.json({ error: z.treeifyError(parsedParams.error) }, 400);
    }

    const { id: userId } = parsedParams.data;

    if (userId === 1) {
      return c.json({ error: "Cannot change role of the primary admin" }, 400);
    }

    const currentUser = c.get("user");
    if (currentUser.userId === userId) {
      return c.json({ error: "Cannot change your own role" }, 400);
    }

    const parsed = updateUserSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    userQueries.setAdmin.run(parsed.data.isAdmin ? 1 : 0, userId);

    return c.json({ message: "User role updated successfully" });
  } catch (error) {
    console.error("Error updating user role:", error);
    return c.json({ error: "Failed to update user role" }, 500);
  }
});

const deleteUserParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});
// Delete user
adminRouter.delete("/users/:id", async (c) => {
  try {
    const parsedParams = deleteUserParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!parsedParams.success) {
      return c.json({ error: z.treeifyError(parsedParams.error) }, 400);
    }

    const userId = parsedParams.data.id;

    if (userId === 1) {
      return c.json({ error: "Cannot delete admin user" }, 400);
    }

    const currentUser = c.get("user");
    if (currentUser.userId === userId) {
      return c.json({ error: "Cannot delete your own account" }, 400);
    }

    userQueries.deleteById.run(userId);
    return c.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Error deleting user:", error);
    return c.json({ error: "Failed to delete user" }, 500);
  }
});

// GET /settings — return all app config settings
adminRouter.get("/settings", (c) => {
  const rows = settingsQueries.getAll.all();
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  return c.json({ settings });
});

const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});

// PUT /settings — update a single app config setting
adminRouter.put("/settings", async (c) => {
  const parsed = updateSettingSchema.safeParse(await c.req.json());
  if (!parsed.success)
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  const { key, value } = parsed.data;
  settingsQueries.set.run(key, value);
  return c.json({ message: "Setting updated" });
});

export { adminRouter };
