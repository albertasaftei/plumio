import { describe, it, expect, beforeAll } from "vitest";
import { request, setupAdmin, registerAndLogin } from "./helpers.js";

let adminToken: string;
let adminOrgId: number;

beforeAll(async () => {
  const admin = await setupAdmin();
  adminToken = admin.token;
  adminOrgId = admin.currentOrganization.id;
});

describe("Organizations API", () => {
  describe("GET /api/organizations", () => {
    it("lists the admin's organizations", async () => {
      const res = await request("GET", "/api/organizations", {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.organizations).toBeDefined();
      expect(body.organizations.length).toBeGreaterThanOrEqual(1);
      expect(body.organizations[0].name).toBe("testadmin's Organization");
    });

    it("returns 401 without auth", async () => {
      const res = await request("GET", "/api/organizations");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/organizations/:id", () => {
    it("returns org details for a member", async () => {
      const res = await request("GET", `/api/organizations/${adminOrgId}`, {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.organization.name).toBe("testadmin's Organization");
      expect(body.organization.role).toBe("admin");
    });
  });

  describe("PUT /api/organizations/:id", () => {
    it("updates org name and slug (admin)", async () => {
      const res = await request("PUT", `/api/organizations/${adminOrgId}`, {
        token: adminToken,
        body: { name: "Updated Org", slug: "updated-org" },
      });
      expect(res.status).toBe(200);
    });

    it("org name is updated", async () => {
      const res = await request("GET", `/api/organizations/${adminOrgId}`, {
        token: adminToken,
      });
      const body = await res.json();
      expect(body.organization.name).toBe("Updated Org");
    });
  });

  describe("Members management", () => {
    let memberToken: string;
    let memberUserId: number;

    it("registers and logs in a second user", async () => {
      const user = await registerAndLogin("orgmember", "orgmember@test.com");
      memberToken = user.token;
      // Get userId from validate
      const valRes = await request("GET", "/api/auth/validate", {
        token: memberToken,
      });
      const val = await valRes.json();
      memberUserId = val.userId;
    });

    it("adds a member to the org", async () => {
      const res = await request(
        "POST",
        `/api/organizations/${adminOrgId}/members`,
        {
          token: adminToken,
          body: { username: "orgmember", role: "member" },
        },
      );
      expect(res.status).toBe(200);
    });

    it("lists members of the org", async () => {
      const res = await request(
        "GET",
        `/api/organizations/${adminOrgId}/members`,
        { token: adminToken },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.members.length).toBeGreaterThanOrEqual(2);
    });

    it("member can switch to the org", async () => {
      const res = await request(
        "POST",
        `/api/organizations/${adminOrgId}/switch`,
        { token: memberToken },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(body.organizationId).toBe(adminOrgId);
      memberToken = body.token;
    });

    it("non-admin member cannot update org", async () => {
      const res = await request("PUT", `/api/organizations/${adminOrgId}`, {
        token: memberToken,
        body: { name: "Hacked", slug: "hacked" },
      });
      expect(res.status).toBe(403);
    });

    it("removes a member from the org", async () => {
      const res = await request(
        "DELETE",
        `/api/organizations/${adminOrgId}/members/${memberUserId}`,
        { token: adminToken },
      );
      expect(res.status).toBe(200);
    });
  });
});
