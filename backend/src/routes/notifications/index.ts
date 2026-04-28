import { Hono } from "hono";
import { notificationQueries } from "../../db/index.js";
import { authMiddleware } from "../../middlewares/auth.js";
import { UserJWTPayload } from "../../middlewares/auth.types.js";
import * as z from "zod";
import {
  notificationIdParamsSchema,
  listNotificationsQuerySchema,
} from "./helpers/schemas.js";

type Variables = {
  user: UserJWTPayload;
};

const notificationsRouter = new Hono<{ Variables: Variables }>();

// All routes require authentication
notificationsRouter.use("*", authMiddleware);

// List notifications (paginated)
notificationsRouter.get("/", async (c) => {
  try {
    const user = c.get("user");
    const parsed = listNotificationsQuerySchema.safeParse({
      page: c.req.query("page"),
      limit: c.req.query("limit"),
    });

    const page = parsed.success ? parsed.data.page : 1;
    const limit = parsed.success ? parsed.data.limit : 20;
    const offset = (page - 1) * limit;

    const notifications = notificationQueries.listByUser.all(
      user.userId,
      limit,
      offset,
    );

    return c.json({ notifications, page, limit });
  } catch (error) {
    console.error("Error listing notifications:", error);
    return c.json({ error: "Failed to list notifications" }, 500);
  }
});

// Get unread count
notificationsRouter.get("/unread-count", async (c) => {
  try {
    const user = c.get("user");
    const result = notificationQueries.countUnread.get(user.userId);
    return c.json({ count: result?.count || 0 });
  } catch (error) {
    console.error("Error getting unread count:", error);
    return c.json({ error: "Failed to get unread count" }, 500);
  }
});

// Mark single notification as read
notificationsRouter.put("/:id/read", async (c) => {
  try {
    const user = c.get("user");
    const parsed = notificationIdParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    notificationQueries.markRead.run(parsed.data.id, user.userId);
    return c.json({ message: "Notification marked as read" });
  } catch (error) {
    console.error("Error marking notification read:", error);
    return c.json({ error: "Failed to mark notification as read" }, 500);
  }
});

// Mark all notifications as read
notificationsRouter.put("/read-all", async (c) => {
  try {
    const user = c.get("user");
    notificationQueries.markAllRead.run(user.userId);
    return c.json({ message: "All notifications marked as read" });
  } catch (error) {
    console.error("Error marking all notifications read:", error);
    return c.json({ error: "Failed to mark all as read" }, 500);
  }
});

// Delete a notification
notificationsRouter.delete("/:id", async (c) => {
  try {
    const user = c.get("user");
    const parsed = notificationIdParamsSchema.safeParse({
      id: c.req.param("id"),
    });

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    notificationQueries.deleteById.run(parsed.data.id, user.userId);
    return c.json({ message: "Notification deleted" });
  } catch (error) {
    console.error("Error deleting notification:", error);
    return c.json({ error: "Failed to delete notification" }, 500);
  }
});

export { notificationsRouter };
