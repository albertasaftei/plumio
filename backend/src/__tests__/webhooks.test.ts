import { describe, it, expect, beforeAll } from "vitest";
import { request, setupAdmin } from "./helpers.js";

let token: string;

const validWebhook = {
  name: "Test Webhook",
  url: "https://example.com/hook",
  secret: "supersecretvalue",
  events: ["document.created", "document.updated"],
};

beforeAll(async () => {
  const admin = await setupAdmin();
  token = admin.token;
});

describe("Webhooks API", () => {
  let webhookId: number;

  // ------------------------------------------------------------------ CREATE
  describe("POST /api/webhooks", () => {
    it("creates a webhook", async () => {
      const res = await request("POST", "/api/webhooks", {
        token,
        body: validWebhook,
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.webhook).toBeDefined();
      expect(body.webhook.name).toBe(validWebhook.name);
      expect(body.webhook.url).toBe(validWebhook.url);
      expect(body.webhook.events).toEqual(validWebhook.events);
      expect(body.webhook.active).toBe(1);
      expect(body.webhook.secret).toBeUndefined(); // secret must be stripped
      webhookId = body.webhook.id;
    });

    it("rejects missing name", async () => {
      const res = await request("POST", "/api/webhooks", {
        token,
        body: { ...validWebhook, name: "" },
      });
      expect(res.status).toBe(400);
    });

    it("rejects invalid URL", async () => {
      const res = await request("POST", "/api/webhooks", {
        token,
        body: { ...validWebhook, url: "not-a-url" },
      });
      expect(res.status).toBe(400);
    });

    it("rejects secret shorter than 8 characters", async () => {
      const res = await request("POST", "/api/webhooks", {
        token,
        body: { ...validWebhook, secret: "short" },
      });
      expect(res.status).toBe(400);
    });

    it("rejects empty events array", async () => {
      const res = await request("POST", "/api/webhooks", {
        token,
        body: { ...validWebhook, events: [] },
      });
      expect(res.status).toBe(400);
    });

    it("rejects unknown event names", async () => {
      const res = await request("POST", "/api/webhooks", {
        token,
        body: {
          ...validWebhook,
          events: ["document.created", "unknown.event"],
        },
      });
      expect(res.status).toBe(400);
    });

    it("returns 401 without auth", async () => {
      const res = await request("POST", "/api/webhooks", {
        body: validWebhook,
      });
      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------ LIST
  describe("GET /api/webhooks", () => {
    it("lists webhooks for the org", async () => {
      const res = await request("GET", "/api/webhooks", { token });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.webhooks)).toBe(true);
      expect(body.webhooks.length).toBeGreaterThanOrEqual(1);
      // Secrets must not be present
      for (const wh of body.webhooks) {
        expect(wh.secret).toBeUndefined();
      }
    });

    it("returns 401 without auth", async () => {
      const res = await request("GET", "/api/webhooks");
      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------ UPDATE
  describe("PUT /api/webhooks/:id", () => {
    it("updates name and events", async () => {
      const res = await request("PUT", `/api/webhooks/${webhookId}`, {
        token,
        body: { name: "Updated Webhook", events: ["tag.created"] },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.webhook.name).toBe("Updated Webhook");
      expect(body.webhook.events).toEqual(["tag.created"]);
      expect(body.webhook.secret).toBeUndefined();
    });

    it("can disable a webhook", async () => {
      const res = await request("PUT", `/api/webhooks/${webhookId}`, {
        token,
        body: { active: false },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.webhook.active).toBe(0);
    });

    it("can re-enable a webhook", async () => {
      const res = await request("PUT", `/api/webhooks/${webhookId}`, {
        token,
        body: { active: true },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.webhook.active).toBe(1);
    });

    it("rejects invalid URL on update", async () => {
      const res = await request("PUT", `/api/webhooks/${webhookId}`, {
        token,
        body: { url: "not-a-url" },
      });
      expect(res.status).toBe(400);
    });

    it("returns 404 for non-existent webhook", async () => {
      const res = await request("PUT", "/api/webhooks/999999", {
        token,
        body: { name: "Ghost" },
      });
      expect(res.status).toBe(404);
    });

    it("returns 401 without auth", async () => {
      const res = await request("PUT", `/api/webhooks/${webhookId}`, {
        body: { name: "Unauth" },
      });
      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------ DELIVERIES
  describe("GET /api/webhooks/:id/deliveries", () => {
    it("returns an empty deliveries list initially", async () => {
      const res = await request(
        "GET",
        `/api/webhooks/${webhookId}/deliveries`,
        { token },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(Array.isArray(body.deliveries)).toBe(true);
      expect(body.page).toBe(1);
      expect(body.limit).toBe(20);
    });

    it("returns 404 for non-existent webhook", async () => {
      const res = await request("GET", "/api/webhooks/999999/deliveries", {
        token,
      });
      expect(res.status).toBe(404);
    });

    it("returns 401 without auth", async () => {
      const res = await request("GET", `/api/webhooks/${webhookId}/deliveries`);
      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------ TEST PING
  describe("POST /api/webhooks/:id/test", () => {
    it("accepts a test ping request", async () => {
      const res = await request("POST", `/api/webhooks/${webhookId}/test`, {
        token,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Test ping sent");
    });

    it("returns 404 for non-existent webhook", async () => {
      const res = await request("POST", "/api/webhooks/999999/test", { token });
      expect(res.status).toBe(404);
    });

    it("returns 401 without auth", async () => {
      const res = await request("POST", `/api/webhooks/${webhookId}/test`);
      expect(res.status).toBe(401);
    });
  });

  // ------------------------------------------------------------------ DELETE
  describe("DELETE /api/webhooks/:id", () => {
    it("deletes the webhook", async () => {
      const res = await request("DELETE", `/api/webhooks/${webhookId}`, {
        token,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Webhook deleted");
    });

    it("returns 404 after deletion", async () => {
      const res = await request("DELETE", `/api/webhooks/${webhookId}`, {
        token,
      });
      expect(res.status).toBe(404);
    });

    it("returns 404 for non-existent webhook", async () => {
      const res = await request("DELETE", "/api/webhooks/999999", { token });
      expect(res.status).toBe(404);
    });

    it("returns 401 without auth", async () => {
      const res = await request("DELETE", `/api/webhooks/${webhookId}`);
      expect(res.status).toBe(401);
    });
  });
});
