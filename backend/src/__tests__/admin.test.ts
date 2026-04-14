import { describe, it, expect, beforeAll } from "vitest";
import { request, setupAdmin } from "./helpers.js";
import { settingsQueries } from "../db/index.js";

let adminToken: string;

beforeAll(async () => {
  const admin = await setupAdmin();
  adminToken = admin.token;
  // The setup endpoint doesn't set is_admin=1 — set it directly in DB
  const { userQueries } = await import("../db/index.js");
  userQueries.setAdmin.run(1, 1); // userId 1 = admin

  // Re-login to get a token with isAdmin: true
  const loginRes = await request("POST", "/api/auth/login", {
    body: { username: "testadmin", password: "password123" },
  });
  const loginBody = await loginRes.json();
  adminToken = loginBody.token;
});

describe("Admin API", () => {
  describe("GET /api/auth/admin/users", () => {
    it("lists all users", async () => {
      const res = await request("GET", "/api/auth/admin/users", {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.users).toBeDefined();
      expect(body.users.length).toBeGreaterThanOrEqual(1);
      expect(body.users[0].username).toBe("testadmin");
    });

    it("returns 401 for non-admin", async () => {
      // Register a regular user
      await request("POST", "/api/auth/register", {
        body: {
          username: "regular",
          email: "regular@test.com",
          password: "password123",
        },
      });
      const loginRes = await request("POST", "/api/auth/login", {
        body: { username: "regular", password: "password123" },
      });
      const { token: regularToken } = await loginRes.json();

      const res = await request("GET", "/api/auth/admin/users", {
        token: regularToken,
      });
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/admin/users", () => {
    it("creates a new user as admin", async () => {
      const res = await request("POST", "/api/auth/admin/users", {
        token: adminToken,
        body: {
          username: "adminCreated",
          email: "admincreated@test.com",
          password: "password123",
        },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("User created successfully");
    });

    it("created user can login", async () => {
      const res = await request("POST", "/api/auth/login", {
        body: { username: "adminCreated", password: "password123" },
      });
      expect(res.status).toBe(200);
    });

    it("rejects duplicate username", async () => {
      const res = await request("POST", "/api/auth/admin/users", {
        token: adminToken,
        body: {
          username: "adminCreated",
          email: "other@test.com",
          password: "password123",
        },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/auth/admin/users/:id", () => {
    it("cannot change primary admin (id=1)", async () => {
      const res = await request("PUT", "/api/auth/admin/users/1", {
        token: adminToken,
        body: { isAdmin: false },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/auth/admin/users/:id", () => {
    it("cannot delete primary admin (id=1)", async () => {
      const res = await request("DELETE", "/api/auth/admin/users/1", {
        token: adminToken,
      });
      expect(res.status).toBe(400);
    });

    it("deletes a non-admin user", async () => {
      // Get the user list to find the adminCreated user's id
      const listRes = await request("GET", "/api/auth/admin/users", {
        token: adminToken,
      });
      const { users } = await listRes.json();
      const target = users.find((u: any) => u.username === "adminCreated");
      expect(target).toBeDefined();

      const res = await request(
        "DELETE",
        `/api/auth/admin/users/${target.id}`,
        { token: adminToken },
      );
      expect(res.status).toBe(200);
    });
  });

  describe("Settings", () => {
    it("GET /api/auth/admin/settings returns settings", async () => {
      const res = await request("GET", "/api/auth/admin/settings", {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.settings).toBeDefined();
    });

    it("PUT /api/auth/admin/settings updates a setting", async () => {
      const res = await request("PUT", "/api/auth/admin/settings", {
        token: adminToken,
        body: { key: "registration_enabled", value: "false" },
      });
      expect(res.status).toBe(200);
    });

    it("registration is now disabled", async () => {
      const res = await request("POST", "/api/auth/register", {
        body: {
          username: "blocked",
          email: "blocked@test.com",
          password: "password123",
        },
      });
      expect(res.status).toBe(403);
    });

    it("re-enable registration", async () => {
      await request("PUT", "/api/auth/admin/settings", {
        token: adminToken,
        body: { key: "registration_enabled", value: "true" },
      });

      const res = await request("POST", "/api/auth/register", {
        body: {
          username: "unblocked",
          email: "unblocked@test.com",
          password: "password123",
        },
      });
      expect(res.status).toBe(200);
    });
  });
});
