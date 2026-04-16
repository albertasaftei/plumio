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

  describe("Organization management (admin)", () => {
    let secondUserId: number;
    let adminOrgId: number; // admin's "Test Org" — known org to test against

    beforeAll(async () => {
      // Create a second user to test org management with
      await request("POST", "/api/auth/admin/users", {
        token: adminToken,
        body: {
          username: "orgTestUser",
          email: "orgtestuser@test.com",
          password: "password123",
        },
      });
      const listRes = await request("GET", "/api/auth/admin/users", {
        token: adminToken,
      });
      const { users } = await listRes.json();
      const target = users.find((u: any) => u.username === "orgTestUser");
      secondUserId = target.id;

      // Grab the admin's org (the first org created during setupAdmin)
      const orgsRes = await request("GET", "/api/auth/admin/organizations", {
        token: adminToken,
      });
      const { organizations } = await orgsRes.json();
      // "Test Org" was created by setupAdmin — find it by matching the admin user's membership
      const adminOrgsRes = await request(
        "GET",
        "/api/auth/admin/users/1/organizations",
        { token: adminToken },
      );
      const { organizations: adminOrgs } = await adminOrgsRes.json();
      const adminOwnerOrg = adminOrgs.find((o: any) => o.isOwner);
      adminOrgId = adminOwnerOrg?.orgId ?? organizations[0].id;
    });

    describe("GET /api/auth/admin/organizations", () => {
      it("returns all organizations", async () => {
        const res = await request("GET", "/api/auth/admin/organizations", {
          token: adminToken,
        });
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.organizations)).toBe(true);
        expect(body.organizations.length).toBeGreaterThanOrEqual(1);
        expect(body.organizations[0]).toMatchObject({
          id: expect.any(Number),
          name: expect.any(String),
          slug: expect.any(String),
          createdAt: expect.any(String),
        });
      });

      it("returns 401 for non-admin", async () => {
        const loginRes = await request("POST", "/api/auth/login", {
          body: { username: "orgTestUser", password: "password123" },
        });
        const { token } = await loginRes.json();
        const res = await request("GET", "/api/auth/admin/organizations", {
          token,
        });
        expect(res.status).toBe(401);
      });
    });

    describe("GET /api/auth/admin/users/:id/organizations", () => {
      it("returns org memberships for the admin user", async () => {
        const res = await request(
          "GET",
          "/api/auth/admin/users/1/organizations",
          { token: adminToken },
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.organizations)).toBe(true);
        expect(body.organizations.length).toBeGreaterThanOrEqual(1);
        expect(body.organizations[0]).toMatchObject({
          orgId: expect.any(Number),
          orgName: expect.any(String),
          role: expect.any(String),
        });
      });

      it("returns empty array for a user with no extra orgs", async () => {
        // orgTestUser has their own personal org from creation; find a second org they're NOT in
        const res = await request(
          "GET",
          `/api/auth/admin/users/${secondUserId}/organizations`,
          { token: adminToken },
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(Array.isArray(body.organizations)).toBe(true);
      });

      it("returns 400 for non-numeric id", async () => {
        const res = await request(
          "GET",
          "/api/auth/admin/users/abc/organizations",
          { token: adminToken },
        );
        expect(res.status).toBe(400);
      });
    });

    describe("POST /api/auth/admin/users/:id/organizations", () => {
      it("adds a user to an organization", async () => {
        const res = await request(
          "POST",
          `/api/auth/admin/users/${secondUserId}/organizations`,
          {
            token: adminToken,
            body: { orgId: adminOrgId, role: "member" },
          },
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.message).toBe("User added to organization successfully");
      });

      it("returns 400 if user is already a member", async () => {
        // User was added to adminOrgId in the previous test — try again
        const res = await request(
          "POST",
          `/api/auth/admin/users/${secondUserId}/organizations`,
          {
            token: adminToken,
            body: { orgId: adminOrgId, role: "member" },
          },
        );
        expect(res.status).toBe(400);
      });

      it("returns 404 for non-existent org", async () => {
        const res = await request(
          "POST",
          `/api/auth/admin/users/${secondUserId}/organizations`,
          {
            token: adminToken,
            body: { orgId: 999999, role: "member" },
          },
        );
        expect(res.status).toBe(404);
      });

      it("rejects invalid role", async () => {
        const res = await request(
          "POST",
          `/api/auth/admin/users/${secondUserId}/organizations`,
          {
            token: adminToken,
            body: { orgId: adminOrgId, role: "superuser" },
          },
        );
        expect(res.status).toBe(400);
      });
    });

    describe("PUT /api/auth/admin/users/:id/organizations/:orgId", () => {
      it("updates a user's role in an organization", async () => {
        // orgTestUser was added to adminOrgId as "member" in the POST tests
        const res = await request(
          "PUT",
          `/api/auth/admin/users/${secondUserId}/organizations/${adminOrgId}`,
          { token: adminToken, body: { role: "admin" } },
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.message).toBe("Role updated successfully");
      });

      it("returns 404 if user is not a member of the org", async () => {
        const res = await request(
          "PUT",
          `/api/auth/admin/users/${secondUserId}/organizations/999999`,
          { token: adminToken, body: { role: "member" } },
        );
        expect(res.status).toBe(404);
      });

      it("rejects invalid role", async () => {
        const res = await request(
          "PUT",
          `/api/auth/admin/users/${secondUserId}/organizations/${adminOrgId}`,
          { token: adminToken, body: { role: "superuser" } },
        );
        expect(res.status).toBe(400);
      });
    });

    describe("DELETE /api/auth/admin/users/:id/organizations/:orgId", () => {
      it("removes a user from an organization", async () => {
        // orgTestUser is in adminOrgId (added in POST tests, role updated in PUT tests)
        const res = await request(
          "DELETE",
          `/api/auth/admin/users/${secondUserId}/organizations/${adminOrgId}`,
          { token: adminToken },
        );
        expect(res.status).toBe(200);
        const body = await res.json();
        expect(body.message).toBe(
          "User removed from organization successfully",
        );
      });

      it("returns 403 when trying to remove the org owner", async () => {
        // Admin user (id=1) owns adminOrgId
        const res = await request(
          "DELETE",
          `/api/auth/admin/users/1/organizations/${adminOrgId}`,
          { token: adminToken },
        );
        expect(res.status).toBe(403);
      });

      it("returns 404 if user is not a member", async () => {
        // orgTestUser was just removed from adminOrgId
        const res = await request(
          "DELETE",
          `/api/auth/admin/users/${secondUserId}/organizations/${adminOrgId}`,
          { token: adminToken },
        );
        expect(res.status).toBe(404);
      });
    });
  });
});
