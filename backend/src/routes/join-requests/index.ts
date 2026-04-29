import { Hono } from "hono";
import {
  organizationQueries,
  memberQueries,
  userQueries,
  joinRequestQueries,
  notificationQueries,
} from "../../db/index.js";
import { authMiddleware } from "../../middlewares/auth.js";
import { UserJWTPayload } from "../../middlewares/auth.types.js";
import * as z from "zod";
import {
  createJoinRequestSchema,
  joinRequestIdParamsSchema,
  orgJoinRequestsParamsSchema,
} from "./helpers/schemas.js";
import {
  sendJoinRequestEmail,
  sendJoinRequestAcceptedEmail,
  sendJoinRequestRejectedEmail,
  sendMemberJoinedEmail,
} from "../../utils/email.js";

type Variables = {
  user: UserJWTPayload;
};

const joinRequestsRouter = new Hono<{ Variables: Variables }>();

// Public: List discoverable organizations (no auth required — called during registration)
joinRequestsRouter.get("/discoverable-orgs", async (c) => {
  try {
    const discoverable = organizationQueries.listDiscoverable.all();

    return c.json({
      organizations: discoverable.map((org) => ({
        id: org.id,
        name: org.name,
        slug: org.slug,
      })),
    });
  } catch (error) {
    console.error("Error listing discoverable orgs:", error);
    return c.json({ error: "Failed to list organizations" }, 500);
  }
});

// All remaining routes require authentication
joinRequestsRouter.use("*", authMiddleware);

// Create a join request
joinRequestsRouter.post("/", async (c) => {
  try {
    const user = c.get("user");
    const parsed = createJoinRequestSchema.safeParse(await c.req.json());

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    const { organizationId, message } = parsed.data;

    // Check org exists
    const org = organizationQueries.findById.get(organizationId);
    if (!org) {
      return c.json({ error: "Organization not found" }, 404);
    }

    // Check user is not already a member
    const existing = memberQueries.findMembership.get(
      organizationId,
      user.userId,
    );
    if (existing) {
      return c.json(
        { error: "You are already a member of this organization" },
        400,
      );
    }

    // Check no duplicate pending request
    const pendingRequest = joinRequestQueries.findPendingByOrgAndUser.get(
      organizationId,
      user.userId,
    );
    if (pendingRequest) {
      return c.json(
        { error: "You already have a pending request for this organization" },
        400,
      );
    }

    // Create the join request
    const result = joinRequestQueries.create.run(
      organizationId,
      user.userId,
      message || null,
    );
    const newRequestId = Number(result.lastInsertRowid);

    // Auto-accept if org has it enabled
    if (org.auto_accept === 1) {
      joinRequestQueries.updateStatus.run(
        "accepted",
        user.userId,
        newRequestId,
      );
      memberQueries.add.run(organizationId, user.userId, "member");

      // Notify the requester they were auto-accepted
      const acceptMetadata = JSON.stringify({
        joinRequestId: newRequestId,
        organizationId,
      });
      notificationQueries.create.run(
        user.userId,
        "join_accepted",
        `Accepted into ${org.name}`,
        `Your request to join ${org.name} has been automatically accepted!`,
        acceptMetadata,
      );

      const requester = userQueries.findById.get(user.userId);
      if (requester?.email) {
        sendJoinRequestAcceptedEmail(requester.email, org.name).catch((err) =>
          console.error("Failed to send auto-acceptance email:", err),
        );
      }

      // Notify org admins that someone joined (informational only — no action needed)
      const orgMembers = memberQueries.listByOrganization.all(organizationId);
      const admins = orgMembers.filter((m) => m.role === "admin");
      const memberJoinedMetadata = JSON.stringify({ organizationId });

      for (const admin of admins) {
        notificationQueries.create.run(
          admin.user_id,
          "join_accepted",
          `${requester?.username || "A user"} joined ${org.name}`,
          `${requester?.username || "A user"} has automatically joined your organization.`,
          memberJoinedMetadata,
        );

        const adminUser = userQueries.findById.get(admin.user_id);
        if (adminUser?.email) {
          sendMemberJoinedEmail(
            adminUser.email,
            requester?.username || "A user",
            org.name,
          ).catch((err) =>
            console.error("Failed to send member joined email:", err),
          );
        }
      }

      return c.json(
        {
          message: "You have been automatically accepted into the organization",
          autoAccepted: true,
        },
        201,
      );
    }

    // Notify all org admins via in-app notifications
    const orgMembers = memberQueries.listByOrganization.all(organizationId);
    const admins = orgMembers.filter((m) => m.role === "admin");

    const requestingUser = userQueries.findById.get(user.userId);
    const metadata = JSON.stringify({
      joinRequestId: newRequestId,
      organizationId,
      userId: user.userId,
    });

    for (const admin of admins) {
      notificationQueries.create.run(
        admin.user_id,
        "join_request",
        `Join request for ${org.name}`,
        `${requestingUser?.username || "A user"} wants to join ${org.name}${message ? `: "${message}"` : ""}`,
        metadata,
      );

      // Send email to admin (best-effort)
      const adminUser = userQueries.findById.get(admin.user_id);
      if (adminUser?.email) {
        sendJoinRequestEmail(
          adminUser.email,
          requestingUser?.username || "Unknown",
          org.name,
        ).catch((err) =>
          console.error("Failed to send join request email:", err),
        );
      }
    }

    return c.json({ message: "Join request sent successfully" }, 201);
  } catch (error) {
    console.error("Error creating join request:", error);
    return c.json({ error: "Failed to create join request" }, 500);
  }
});

// List current user's join requests
joinRequestsRouter.get("/mine", async (c) => {
  try {
    const user = c.get("user");
    const requests = joinRequestQueries.listByUser.all(user.userId);
    return c.json({ requests });
  } catch (error) {
    console.error("Error listing join requests:", error);
    return c.json({ error: "Failed to list join requests" }, 500);
  }
});

// List pending join requests for an organization (org admin only)
joinRequestsRouter.get("/org/:orgId", async (c) => {
  try {
    const user = c.get("user");
    const parsed = orgJoinRequestsParamsSchema.safeParse({
      orgId: c.req.param("orgId"),
    });

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    const { orgId } = parsed.data;

    // Check user is org admin
    const isAdmin = memberQueries.isAdmin.get(orgId, user.userId);
    if (!isAdmin || isAdmin.count === 0) {
      return c.json(
        { error: "Only organization admins can view join requests" },
        403,
      );
    }

    const requests = joinRequestQueries.listPendingByOrg.all(orgId);
    return c.json({ requests });
  } catch (error) {
    console.error("Error listing org join requests:", error);
    return c.json({ error: "Failed to list join requests" }, 500);
  }
});

// Accept a join request (org admin only)
joinRequestsRouter.put("/:id/accept", async (c) => {
  try {
    const user = c.get("user");
    const parsed = joinRequestIdParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    const request = joinRequestQueries.findById.get(parsed.data.id);
    if (!request) {
      return c.json({ error: "Join request not found" }, 404);
    }

    if (request.status !== "pending") {
      return c.json({ error: "This request has already been processed" }, 400);
    }

    // Check user is org admin
    const isAdmin = memberQueries.isAdmin.get(
      request.organization_id,
      user.userId,
    );
    if (!isAdmin || isAdmin.count === 0) {
      return c.json(
        { error: "Only organization admins can accept requests" },
        403,
      );
    }

    // Accept: update status + add user as member
    joinRequestQueries.updateStatus.run("accepted", user.userId, request.id);
    memberQueries.add.run(request.organization_id, request.user_id, "member");

    // Notify the requester
    const org = organizationQueries.findById.get(request.organization_id);
    const metadata = JSON.stringify({
      joinRequestId: request.id,
      organizationId: request.organization_id,
    });

    notificationQueries.create.run(
      request.user_id,
      "join_accepted",
      `Accepted into ${org?.name || "organization"}`,
      `Your request to join ${org?.name || "the organization"} has been accepted!`,
      metadata,
    );

    // Send email (best-effort)
    const requester = userQueries.findById.get(request.user_id);
    if (requester?.email && org) {
      sendJoinRequestAcceptedEmail(requester.email, org.name).catch((err) =>
        console.error("Failed to send acceptance email:", err),
      );
    }

    return c.json({ message: "Join request accepted" });
  } catch (error: any) {
    if (error.message?.includes("UNIQUE")) {
      return c.json(
        { error: "User is already a member of this organization" },
        400,
      );
    }
    console.error("Error accepting join request:", error);
    return c.json({ error: "Failed to accept join request" }, 500);
  }
});

// Reject a join request (org admin only)
joinRequestsRouter.put("/:id/reject", async (c) => {
  try {
    const user = c.get("user");
    const parsed = joinRequestIdParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    const request = joinRequestQueries.findById.get(parsed.data.id);
    if (!request) {
      return c.json({ error: "Join request not found" }, 404);
    }

    if (request.status !== "pending") {
      return c.json({ error: "This request has already been processed" }, 400);
    }

    // Check user is org admin
    const isAdmin = memberQueries.isAdmin.get(
      request.organization_id,
      user.userId,
    );
    if (!isAdmin || isAdmin.count === 0) {
      return c.json(
        { error: "Only organization admins can reject requests" },
        403,
      );
    }

    // Reject: update status
    joinRequestQueries.updateStatus.run("rejected", user.userId, request.id);

    // Notify the requester
    const org = organizationQueries.findById.get(request.organization_id);
    const metadata = JSON.stringify({
      joinRequestId: request.id,
      organizationId: request.organization_id,
    });

    notificationQueries.create.run(
      request.user_id,
      "join_rejected",
      `Request declined for ${org?.name || "organization"}`,
      `Your request to join ${org?.name || "the organization"} was declined.`,
      metadata,
    );

    // Send email (best-effort)
    const requester = userQueries.findById.get(request.user_id);
    if (requester?.email && org) {
      sendJoinRequestRejectedEmail(requester.email, org.name).catch((err) =>
        console.error("Failed to send rejection email:", err),
      );
    }

    return c.json({ message: "Join request rejected" });
  } catch (error) {
    console.error("Error rejecting join request:", error);
    return c.json({ error: "Failed to reject join request" }, 500);
  }
});

// Cancel own pending request
joinRequestsRouter.delete("/:id", async (c) => {
  try {
    const user = c.get("user");
    const parsed = joinRequestIdParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    const request = joinRequestQueries.findById.get(parsed.data.id);
    if (!request) {
      return c.json({ error: "Join request not found" }, 404);
    }

    if (request.user_id !== user.userId) {
      return c.json({ error: "You can only cancel your own requests" }, 403);
    }

    if (request.status !== "pending") {
      return c.json({ error: "Only pending requests can be cancelled" }, 400);
    }

    joinRequestQueries.deleteById.run(request.id);
    return c.json({ message: "Join request cancelled" });
  } catch (error) {
    console.error("Error cancelling join request:", error);
    return c.json({ error: "Failed to cancel join request" }, 500);
  }
});

export { joinRequestsRouter };
