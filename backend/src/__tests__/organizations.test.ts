import {
  describe,
  it,
  expect,
  beforeAll,
  beforeEach,
  afterEach,
} from "vitest";
import { request, setupAdmin, registerAndLogin } from "./helpers.js";
import { memberQueries, sessionQueries } from "../db/index.js";

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
    let memberUsername: string;
    let memberSequence = 0;

    beforeEach(async () => {
      memberUsername = `orgmember${++memberSequence}`;
      const user = await registerAndLogin(
        memberUsername,
        `${memberUsername}@test.com`,
      );
      memberToken = user.token;
      const valRes = await request("GET", "/api/auth/validate", {
        token: memberToken,
      });
      const val = await valRes.json();
      memberUserId = val.userId;

      const addRes = await request(
        "POST",
        `/api/organizations/${adminOrgId}/members`,
        {
          token: adminToken,
          body: { username: memberUsername, role: "member" },
        },
      );
      expect(addRes.status).toBe(200);
    });

    afterEach(() => {
      sessionQueries.deleteByUserId.run(memberUserId);
      memberQueries.remove.run(adminOrgId, memberUserId);
    });

    async function switchMemberToOrg() {
      const res = await request(
        "POST",
        `/api/organizations/${adminOrgId}/switch`,
        { token: memberToken },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      memberToken = body.token;
      return body;
    }

    it("lists the member in the org", async () => {
      const res = await request(
        "GET",
        `/api/organizations/${adminOrgId}/members`,
        { token: adminToken },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.members.some((member: any) => member.username === memberUsername)).toBe(
        true,
      );
    });

    it("member can switch to the org", async () => {
      const body = await switchMemberToOrg();
      expect(body.token).toBeDefined();
      expect(body.organizationId).toBe(adminOrgId);
    });

    it("non-admin member cannot update org", async () => {
      await switchMemberToOrg();
      const res = await request("PUT", `/api/organizations/${adminOrgId}`, {
        token: memberToken,
        body: { name: "Hacked", slug: "hacked" },
      });
      expect(res.status).toBe(403);
    });

    it("enforces role changes on an already issued token", async () => {
      await switchMemberToOrg();
      const updateOrg = () =>
        request("PUT", `/api/organizations/${adminOrgId}`, {
          token: memberToken,
          body: { name: "Updated Org", slug: "updated-org" },
        });

      memberQueries.updateRole.run("admin", adminOrgId, memberUserId);
      expect((await updateOrg()).status).toBe(200);

      memberQueries.updateRole.run("member", adminOrgId, memberUserId);
      expect((await updateOrg()).status).toBe(403);
    });

    it("rejects a token after membership disappears while its session exists", async () => {
      await switchMemberToOrg();
      const staleToken = memberToken;
      memberQueries.remove.run(adminOrgId, memberUserId);
      expect(sessionQueries.findByToken.get(staleToken)).toBeDefined();

      const res = await request("GET", "/api/documents/list?path=/", {
        token: staleToken,
      });
      expect(res.status).toBe(401);

      const addRes = await request(
        "POST",
        `/api/organizations/${adminOrgId}/members`,
        {
          token: adminToken,
          body: { username: memberUsername, role: "member" },
        },
      );
      expect(addRes.status).toBe(200);

      const staleRes = await request("GET", "/api/documents/list?path=/", {
        token: staleToken,
      });
      expect(staleRes.status).toBe(401);

      const loginRes = await request("POST", "/api/auth/login", {
        body: { username: memberUsername, password: "password123" },
      });
      const { token } = await loginRes.json();
      const switchRes = await request(
        "POST",
        `/api/organizations/${adminOrgId}/switch`,
        { token },
      );
      expect(switchRes.status).toBe(200);
      memberToken = (await switchRes.json()).token;
    });

    it("removes a member from the org", async () => {
      await switchMemberToOrg();
      const staleToken = memberToken;
      const res = await request(
        "DELETE",
        `/api/organizations/${adminOrgId}/members/${memberUserId}`,
        { token: adminToken },
      );
      expect(res.status).toBe(200);

      const staleRes = await request("GET", "/api/documents/list?path=/", {
        token: staleToken,
      });
      expect(staleRes.status).toBe(401);

      const addRes = await request(
        "POST",
        `/api/organizations/${adminOrgId}/members`,
        {
          token: adminToken,
          body: { username: memberUsername, role: "member" },
        },
      );
      expect(addRes.status).toBe(200);

      const readdedRes = await request("GET", "/api/documents/list?path=/", {
        token: staleToken,
      });
      expect(readdedRes.status).toBe(401);
    });
  });
});
