import { describe, it, expect, beforeAll } from "vitest";
import { request, setupAdmin } from "./helpers.js";

let adminToken: string;
let adminOrgId: number;

beforeAll(async () => {
  const admin = await setupAdmin();
  adminToken = admin.token;
  adminOrgId = admin.currentOrganization.id;
});

describe("Notifications API", () => {
  describe("GET /api/notifications", () => {
    it("requires authentication", async () => {
      const res = await request("GET", "/api/notifications");
      expect(res.status).toBe(401);
    });

    it("returns empty notifications list initially", async () => {
      const res = await request("GET", "/api/notifications", {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.notifications).toBeDefined();
      expect(Array.isArray(body.notifications)).toBe(true);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
    });

    it("respects page and limit query params", async () => {
      const res = await request("GET", "/api/notifications?page=2&limit=5", {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.page).toBe(2);
      expect(body.limit).toBe(5);
    });
  });

  describe("GET /api/notifications/unread-count", () => {
    it("requires authentication", async () => {
      const res = await request("GET", "/api/notifications/unread-count");
      expect(res.status).toBe(401);
    });

    it("returns zero unread count initially", async () => {
      const res = await request("GET", "/api/notifications/unread-count", {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.count).toBeDefined();
      expect(typeof body.count).toBe("number");
      expect(body.count).toBe(0);
    });

    it("unread count increases after a join request is created", async () => {
      // Create a second user and have them request to join the admin's org
      // This generates a notification for the admin
      await request("POST", "/api/auth/register", {
        body: {
          username: "notifuser",
          email: "notifuser@test.com",
          password: "password123",
        },
      });
      const loginRes = await request("POST", "/api/auth/login", {
        body: { username: "notifuser", password: "password123" },
      });
      const { token: notifToken } = await loginRes.json();

      await request("POST", "/api/join-requests", {
        token: notifToken,
        body: { organizationId: adminOrgId },
      });

      const res = await request("GET", "/api/notifications/unread-count", {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.count).toBeGreaterThanOrEqual(1);
    });
  });

  describe("PUT /api/notifications/:id/read", () => {
    let notifId: number;

    beforeAll(async () => {
      const res = await request("GET", "/api/notifications", {
        token: adminToken,
      });
      const body = await res.json();
      notifId = body.notifications[0]?.id;
    });

    it("requires authentication", async () => {
      const res = await request("PUT", `/api/notifications/${notifId}/read`);
      expect(res.status).toBe(401);
    });

    it("marks a notification as read", async () => {
      const res = await request("PUT", `/api/notifications/${notifId}/read`, {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Notification marked as read");
    });

    it("unread count decreases after marking read", async () => {
      const res = await request("GET", "/api/notifications/unread-count", {
        token: adminToken,
      });
      const body = await res.json();
      expect(body.count).toBe(0);
    });
  });

  describe("PUT /api/notifications/read-all", () => {
    beforeAll(async () => {
      // Create another join request to generate a new unread notification
      await request("POST", "/api/auth/register", {
        body: {
          username: "notifuser2",
          email: "notifuser2@test.com",
          password: "password123",
        },
      });
      const loginRes = await request("POST", "/api/auth/login", {
        body: { username: "notifuser2", password: "password123" },
      });
      const { token } = await loginRes.json();
      await request("POST", "/api/join-requests", {
        token,
        body: { organizationId: adminOrgId },
      });
    });

    it("requires authentication", async () => {
      const res = await request("PUT", "/api/notifications/read-all");
      expect(res.status).toBe(401);
    });

    it("marks all notifications as read", async () => {
      const res = await request("PUT", "/api/notifications/read-all", {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("All notifications marked as read");
    });

    it("unread count is zero after mark-all-read", async () => {
      const res = await request("GET", "/api/notifications/unread-count", {
        token: adminToken,
      });
      const body = await res.json();
      expect(body.count).toBe(0);
    });
  });

  describe("DELETE /api/notifications/:id", () => {
    let notifId: number;

    beforeAll(async () => {
      const res = await request("GET", "/api/notifications", {
        token: adminToken,
      });
      const body = await res.json();
      notifId = body.notifications[0]?.id;
    });

    it("requires authentication", async () => {
      const res = await request("DELETE", `/api/notifications/${notifId}`);
      expect(res.status).toBe(401);
    });

    it("deletes a notification", async () => {
      const res = await request("DELETE", `/api/notifications/${notifId}`, {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Notification deleted");
    });

    it("notification is no longer in the list after deletion", async () => {
      const res = await request("GET", "/api/notifications", {
        token: adminToken,
      });
      const body = await res.json();
      const ids = body.notifications.map((n: any) => n.id);
      expect(ids).not.toContain(notifId);
    });
  });
});
