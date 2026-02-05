import { Hono } from "hono";
import bcrypt from "bcrypt";
import {
  userQueries,
  organizationQueries,
  memberQueries,
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
      isAdmin: user.id === 1,
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
});
// Create new user
adminRouter.post("/users", async (c) => {
  try {
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

export { adminRouter };
