import { Hono } from "hono";
import bcrypt from "bcrypt";
import {
  userQueries,
  organizationQueries,
  memberQueries,
} from "../db/index.js";
import { adminMiddleware } from "../middlewares/auth.js";
import { User } from "../db/index.types.js";
import { UserContext } from "../middlewares/auth.types.js";

const adminRouter = new Hono<{ Variables: { user: UserContext } }>();

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

// Create new user
adminRouter.post("/users", async (c) => {
  try {
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

// Delete user
adminRouter.delete("/users/:id", async (c) => {
  try {
    const userId = parseInt(c.req.param("id"));

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
