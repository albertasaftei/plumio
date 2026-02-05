import { Hono } from "hono";
import { SignJWT } from "jose";
import { JWT_SECRET } from "../config.js";
import {
  organizationQueries,
  memberQueries,
  userQueries,
  sessionQueries,
} from "../db/index.js";
import { authMiddleware } from "../middlewares/auth.js";
import { UserJWTPayload } from "../middlewares/auth.types.js";
import * as z from "zod";

type Variables = {
  user: UserJWTPayload;
};

const organizationsRouter = new Hono<{ Variables: Variables }>();
const jwtSecretKey = new TextEncoder().encode(JWT_SECRET);

// All routes require authentication
organizationsRouter.use("*", authMiddleware);

// List user's organizations
organizationsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const organizations = organizationQueries.listByUser.all(user.userId);

    // Add member role for each organization
    const orgsWithRoles = organizations.map((org) => {
      const membership = memberQueries.findMembership.get(org.id, user.userId);
      return {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: membership?.role || "member",
        createdAt: org.created_at,
      };
    });

    return c.json({ organizations: orgsWithRoles });
  } catch (error) {
    console.error("Error listing organizations:", error);
    return c.json({ error: "Failed to list organizations" }, 500);
  }
});

const getOrgParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});
// Get organization details
organizationsRouter.get("/:id", async (c) => {
  try {
    const user = c.get("user");
    const parsedParams = getOrgParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!parsedParams.success) {
      return c.json({ error: z.treeifyError(parsedParams.error) }, 400);
    }

    const { id: orgId } = parsedParams.data;

    // Verify user has access
    const membership = memberQueries.findMembership.get(orgId, user.userId);
    if (!membership) {
      return c.json({ error: "Access denied" }, 403);
    }

    const org = organizationQueries.findById.get(orgId);
    if (!org) {
      return c.json({ error: "Organization not found" }, 404);
    }

    return c.json({
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: membership.role,
        createdAt: org.created_at,
      },
    });
  } catch (error) {
    console.error("Error getting organization:", error);
    return c.json({ error: "Failed to get organization" }, 500);
  }
});

// Switch active organization
organizationsRouter.post("/:id/switch", async (c) => {
  try {
    const user = c.get("user");
    const orgId = parseInt(c.req.param("id"));

    // Verify user has access
    const membership = memberQueries.findMembership.get(orgId, user.userId);
    if (!membership) {
      return c.json({ error: "Access denied" }, 403);
    }

    // Get organization details
    const org = organizationQueries.findById.get(orgId);
    if (!org) {
      return c.json({ error: "Organization not found" }, 404);
    }

    // Generate new JWT with updated organization context
    const token = await new SignJWT({
      userId: user.userId,
      username: user.username,
      isAdmin: user.isAdmin,
      currentOrgId: orgId,
      orgRole: membership.role,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("30d")
      .sign(jwtSecretKey);

    // Update session with new token and organization
    const authHeader = c.req.header("Authorization");
    const oldToken = authHeader!.substring(7);

    // Get session info
    const session = sessionQueries.findByToken.get(oldToken);
    if (session) {
      // Delete old session
      sessionQueries.deleteByToken.run(oldToken);

      // Create new session with new token
      const expiresAt = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      sessionQueries.create.run(
        session.id,
        user.userId,
        token,
        orgId,
        expiresAt,
      );
    }

    return c.json({
      message: "Organization switched successfully",
      organizationId: orgId,
      token, // Return new token
      organization: {
        id: org.id,
        name: org.name,
        slug: org.slug,
        role: membership.role,
      },
    });
  } catch (error) {
    console.error("Error switching organization:", error);
    return c.json({ error: "Failed to switch organization" }, 500);
  }
});

const updateOrgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
});

const updateOrgParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});
// Update organization (admin only)
organizationsRouter.put("/:id", async (c) => {
  try {
    const user = c.get("user");
    const parsedOrgId = updateOrgParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!parsedOrgId.success) {
      return c.json({ error: z.treeifyError(parsedOrgId.error) }, 400);
    }

    const { id: orgId } = parsedOrgId.data;

    // Verify user is admin
    const isAdmin = memberQueries.isAdmin.get(orgId, user.userId);
    if (!isAdmin || isAdmin.count === 0) {
      return c.json({ error: "Admin access required" }, 403);
    }

    const parsed = updateOrgSchema.safeParse(await c.req.json());

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    const { name, slug } = parsed.data;

    if (!name || !slug) {
      return c.json({ error: "Name and slug are required" }, 400);
    }

    organizationQueries.update.run(name, slug, orgId);

    return c.json({ message: "Organization updated successfully" });
  } catch (error: any) {
    console.error("Error updating organization:", error);
    if (error.message.includes("UNIQUE")) {
      return c.json({ error: "Slug already exists" }, 400);
    }
    return c.json({ error: "Failed to update organization" }, 500);
  }
});

const createOrgParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});

// List organization members (members can view)
organizationsRouter.get("/:id/members", async (c) => {
  try {
    const user = c.get("user");
    const parsedOrgId = createOrgParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!parsedOrgId.success) {
      return c.json({ error: z.treeifyError(parsedOrgId.error) }, 400);
    }

    const { id: orgId } = parsedOrgId.data;

    // Verify user has access
    const membership = memberQueries.findMembership.get(orgId, user.userId);
    if (!membership) {
      return c.json({ error: "Access denied" }, 403);
    }

    // Get organization to know the owner
    const org = organizationQueries.findById.get(orgId);
    const ownerId = org?.owner_id;

    const members = memberQueries.listByOrganization.all(orgId);

    const memberList = members.map((m) => ({
      id: m.user_id,
      username: m.username,
      email: m.email,
      role: m.role,
      joinedAt: m.joined_at,
      isOwner: m.user_id === ownerId,
    }));

    return c.json({ members: memberList });
  } catch (error) {
    console.error("Error listing members:", error);
    return c.json({ error: "Failed to list members" }, 500);
  }
});

const addMemberSchema = z.object({
  username: z.string().min(1),
  role: z.enum(["admin", "member"]).optional(),
});

const addMemberParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});

// Add member to organization (admin only)
organizationsRouter.post("/:id/members", async (c) => {
  try {
    const user = c.get("user");
    const parsedOrgId = addMemberParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!parsedOrgId.success) {
      return c.json({ error: z.treeifyError(parsedOrgId.error) }, 400);
    }

    const { id: orgId } = parsedOrgId.data;

    // Verify user is admin
    const isAdmin = memberQueries.isAdmin.get(orgId, user.userId);
    if (!isAdmin || isAdmin.count === 0) {
      return c.json({ error: "Admin access required" }, 403);
    }

    const parsed = addMemberSchema.safeParse(await c.req.json());

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    const { username, role = "member" } = parsed.data;

    if (!username) {
      return c.json({ error: "Username is required" }, 400);
    }

    if (role !== "admin" && role !== "member") {
      return c.json({ error: "Invalid role" }, 400);
    }

    // Find user by username
    const targetUser = userQueries.findByUsername.get(username);
    if (!targetUser) {
      return c.json({ error: "User not found" }, 404);
    }

    // Check if already a member
    const existing = memberQueries.findMembership.get(orgId, targetUser.id);
    if (existing) {
      return c.json({ error: "User is already a member" }, 400);
    }

    memberQueries.add.run(orgId, targetUser.id, role);

    return c.json({ message: "Member added successfully" });
  } catch (error) {
    console.error("Error adding member:", error);
    return c.json({ error: "Failed to add member" }, 500);
  }
});

const updateMemberParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
  userId: z.string().transform((val) => parseInt(val)),
});

const updateMemberSchema = z.object({
  role: z.enum(["admin", "member"]),
});

// Update member role (admin only)
organizationsRouter.put("/:id/members/:userId", async (c) => {
  try {
    const user = c.get("user");
    const parsedParams = updateMemberParamsSchema.safeParse({
      id: c.req.param("id"),
      userId: c.req.param("userId"),
    });

    if (!parsedParams.success) {
      return c.json({ error: z.treeifyError(parsedParams.error) }, 400);
    }

    const { id: orgId, userId: targetUserId } = parsedParams.data;

    // Verify user is admin
    const isAdmin = memberQueries.isAdmin.get(orgId, user.userId);
    if (!isAdmin || isAdmin.count === 0) {
      return c.json({ error: "Admin access required" }, 403);
    }

    const parsed = updateMemberSchema.safeParse(await c.req.json());

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    const { role } = parsed.data;

    if (role !== "admin" && role !== "member") {
      return c.json({ error: "Invalid role" }, 400);
    }
    memberQueries.updateRole.run(role, orgId, targetUserId);

    return c.json({ message: "Member role updated successfully" });
  } catch (error) {
    console.error("Error updating member role:", error);
    return c.json({ error: "Failed to update member role" }, 500);
  }
});

const getUserRoleParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});
// Get current user's role in organization
organizationsRouter.get("/:id/role", async (c) => {
  try {
    const user = c.get("user");
    const parsedOrgId = getUserRoleParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!parsedOrgId.success) {
      return c.json({ error: z.treeifyError(parsedOrgId.error) }, 400);
    }

    const { id: orgId } = parsedOrgId.data;

    const membership = memberQueries.findMembership.get(orgId, user.userId);

    if (!membership) {
      return c.json({ error: "Not a member of this organization" }, 404);
    }

    return c.json({ role: membership.role });
  } catch (error) {
    console.error("Error getting user role:", error);
    return c.json({ error: "Failed to get user role" }, 500);
  }
});

const removeMemberParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
  userId: z.string().transform((val) => parseInt(val)),
});

// Remove member from organization (admin only)
organizationsRouter.delete("/:id/members/:userId", async (c) => {
  try {
    const user = c.get("user");
    const parsedParams = removeMemberParamsSchema.safeParse({
      id: c.req.param("id"),
      userId: c.req.param("userId"),
    });

    if (!parsedParams.success) {
      return c.json({ error: z.treeifyError(parsedParams.error) }, 400);
    }

    const { id: orgId, userId: targetUserId } = parsedParams.data;

    // Verify user is admin
    const isAdmin = memberQueries.isAdmin.get(orgId, user.userId);
    if (!isAdmin || isAdmin.count === 0) {
      return c.json({ error: "Admin access required" }, 403);
    }

    // Can't remove yourself
    if (targetUserId === user.userId) {
      return c.json(
        { error: "Cannot remove yourself from the organization" },
        400,
      );
    }

    // Can't remove the organization owner
    const org = organizationQueries.findById.get(orgId);
    if (org && org.owner_id === targetUserId) {
      return c.json({ error: "Cannot remove the organization owner" }, 403);
    }

    memberQueries.remove.run(orgId, targetUserId);

    return c.json({ message: "Member removed successfully" });
  } catch (error) {
    console.error("Error removing member:", error);
    return c.json({ error: "Failed to remove member" }, 500);
  }
});

export { organizationsRouter };
