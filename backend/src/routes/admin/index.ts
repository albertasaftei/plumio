import { Hono } from "hono";
import bcrypt from "bcrypt";
import {
  userQueries,
  organizationQueries,
  memberQueries,
  settingsQueries,
} from "../../db/index.js";
import { adminMiddleware } from "../../middlewares/auth.js";
import { UserJWTPayload } from "../../middlewares/auth.types.js";
import * as z from "zod";
import {
  registerSchema,
  updateUserParamsSchema,
  updateUserSchema,
  deleteUserParamsSchema,
  updateSettingSchema,
  adminUserParamsSchema,
  adminUserOrgParamsSchema,
  adminAddUserToOrgSchema,
  adminUpdateUserOrgRoleSchema,
} from "./helpers/schemas.js";

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

// PUT /settings — update a single app config setting
adminRouter.put("/settings", async (c) => {
  const parsed = updateSettingSchema.safeParse(await c.req.json());
  if (!parsed.success)
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  const { key, value } = parsed.data;
  settingsQueries.set.run(key, value);
  return c.json({ message: "Setting updated" });
});

// GET /organizations — list all organizations
adminRouter.get("/organizations", (c) => {
  try {
    const orgs = organizationQueries.listAll.all();
    return c.json({
      organizations: orgs.map((o) => ({
        id: o.id,
        name: o.name,
        slug: o.slug,
        createdAt: o.created_at,
      })),
    });
  } catch (error) {
    console.error("Error listing organizations:", error);
    return c.json({ error: "Failed to list organizations" }, 500);
  }
});

// GET /users/:id/organizations — list all org memberships for a user
adminRouter.get("/users/:id/organizations", (c) => {
  try {
    const parsedParams = adminUserParamsSchema.safeParse({
      id: c.req.param("id"),
    });
    if (!parsedParams.success) {
      return c.json({ error: z.treeifyError(parsedParams.error) }, 400);
    }
    const { id: userId } = parsedParams.data;
    const memberships = memberQueries.listByUser.all(userId);
    return c.json({
      organizations: memberships.map((m) => ({
        orgId: m.id,
        orgName: m.name,
        orgSlug: m.slug,
        role: m.role,
        joinedAt: m.joined_at,
        isOwner: m.owner_id === userId,
      })),
    });
  } catch (error) {
    console.error("Error listing user organizations:", error);
    return c.json({ error: "Failed to list user organizations" }, 500);
  }
});

// POST /users/:id/organizations — add user to an organization
adminRouter.post("/users/:id/organizations", async (c) => {
  try {
    const parsedParams = adminUserParamsSchema.safeParse({
      id: c.req.param("id"),
    });
    if (!parsedParams.success) {
      return c.json({ error: z.treeifyError(parsedParams.error) }, 400);
    }
    const { id: userId } = parsedParams.data;

    const parsed = adminAddUserToOrgSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }
    const { orgId, role } = parsed.data;

    const org = organizationQueries.findById.get(orgId);
    if (!org) {
      return c.json({ error: "Organization not found" }, 404);
    }

    const existing = memberQueries.findMembership.get(orgId, userId);
    if (existing) {
      return c.json(
        { error: "User is already a member of this organization" },
        400,
      );
    }

    memberQueries.add.run(orgId, userId, role);
    return c.json({ message: "User added to organization successfully" });
  } catch (error) {
    console.error("Error adding user to organization:", error);
    return c.json({ error: "Failed to add user to organization" }, 500);
  }
});

// PUT /users/:id/organizations/:orgId — update user's role in an organization
adminRouter.put("/users/:id/organizations/:orgId", async (c) => {
  try {
    const parsedParams = adminUserOrgParamsSchema.safeParse({
      id: c.req.param("id"),
      orgId: c.req.param("orgId"),
    });
    if (!parsedParams.success) {
      return c.json({ error: z.treeifyError(parsedParams.error) }, 400);
    }
    const { id: userId, orgId } = parsedParams.data;

    const parsed = adminUpdateUserOrgRoleSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }
    const { role } = parsed.data;

    const existing = memberQueries.findMembership.get(orgId, userId);
    if (!existing) {
      return c.json(
        { error: "User is not a member of this organization" },
        404,
      );
    }

    memberQueries.updateRole.run(role, orgId, userId);
    return c.json({ message: "Role updated successfully" });
  } catch (error) {
    console.error("Error updating user org role:", error);
    return c.json({ error: "Failed to update role" }, 500);
  }
});

// DELETE /users/:id/organizations/:orgId — remove user from an organization
adminRouter.delete("/users/:id/organizations/:orgId", (c) => {
  try {
    const parsedParams = adminUserOrgParamsSchema.safeParse({
      id: c.req.param("id"),
      orgId: c.req.param("orgId"),
    });
    if (!parsedParams.success) {
      return c.json({ error: z.treeifyError(parsedParams.error) }, 400);
    }
    const { id: userId, orgId } = parsedParams.data;

    const org = organizationQueries.findById.get(orgId);
    if (org && org.owner_id === userId) {
      return c.json(
        { error: "Cannot remove the owner from their organization" },
        403,
      );
    }

    const existing = memberQueries.findMembership.get(orgId, userId);
    if (!existing) {
      return c.json(
        { error: "User is not a member of this organization" },
        404,
      );
    }

    memberQueries.remove.run(orgId, userId);
    return c.json({ message: "User removed from organization successfully" });
  } catch (error) {
    console.error("Error removing user from organization:", error);
    return c.json({ error: "Failed to remove user from organization" }, 500);
  }
});

export { adminRouter };
