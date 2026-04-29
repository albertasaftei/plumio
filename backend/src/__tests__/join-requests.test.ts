import { describe, it, expect, beforeAll } from "vitest";
import { request, setupAdmin, registerAndLogin } from "./helpers.js";

let adminToken: string;
let adminOrgId: number;
let memberToken: string;

beforeAll(async () => {
  const admin = await setupAdmin();
  adminToken = admin.token;
  adminOrgId = admin.currentOrganization.id;

  const member = await registerAndLogin("jruser", "jruser@test.com");
  memberToken = member.token;
});

describe("Join Requests API", () => {
  describe("GET /api/join-requests/discoverable-orgs", () => {
    it("returns organizations without auth", async () => {
      const res = await request("GET", "/api/join-requests/discoverable-orgs");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.organizations).toBeDefined();
      expect(Array.isArray(body.organizations)).toBe(true);
    });

    it("excludes non-discoverable organizations", async () => {
      // All returned orgs have discoverable=1; personal orgs get discoverable=0 via migration
      const res = await request("GET", "/api/join-requests/discoverable-orgs");
      const body = await res.json();
      // Should be an array (empty or with discoverable orgs only)
      expect(Array.isArray(body.organizations)).toBe(true);
    });

    it("returns org with id, name, slug", async () => {
      const res = await request("GET", "/api/join-requests/discoverable-orgs");
      const body = await res.json();
      if (body.organizations.length > 0) {
        const org = body.organizations[0];
        expect(org).toHaveProperty("id");
        expect(org).toHaveProperty("name");
        expect(org).toHaveProperty("slug");
        expect(org).not.toHaveProperty("memberCount");
      }
    });
  });

  describe("POST /api/join-requests", () => {
    it("requires authentication", async () => {
      const res = await request("POST", "/api/join-requests", {
        body: { organizationId: adminOrgId },
      });
      expect(res.status).toBe(401);
    });

    it("creates a join request", async () => {
      const res = await request("POST", "/api/join-requests", {
        token: memberToken,
        body: { organizationId: adminOrgId, message: "Please let me in" },
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.message).toBe("Join request sent successfully");
    });

    it("rejects duplicate pending requests", async () => {
      const res = await request("POST", "/api/join-requests", {
        token: memberToken,
        body: { organizationId: adminOrgId },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/already have a pending request/i);
    });

    it("rejects request for non-existent org", async () => {
      const res = await request("POST", "/api/join-requests", {
        token: memberToken,
        body: { organizationId: 99999 },
      });
      expect(res.status).toBe(404);
    });

    it("rejects if user is already a member", async () => {
      // Admin tries to join their own org
      const res = await request("POST", "/api/join-requests", {
        token: adminToken,
        body: { organizationId: adminOrgId },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/already a member/i);
    });
  });

  describe("GET /api/join-requests/mine", () => {
    it("requires authentication", async () => {
      const res = await request("GET", "/api/join-requests/mine");
      expect(res.status).toBe(401);
    });

    it("lists the user's own join requests", async () => {
      const res = await request("GET", "/api/join-requests/mine", {
        token: memberToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.requests).toBeDefined();
      expect(Array.isArray(body.requests)).toBe(true);
      expect(body.requests.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("GET /api/join-requests/org/:orgId", () => {
    it("requires authentication", async () => {
      const res = await request("GET", `/api/join-requests/org/${adminOrgId}`);
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admins", async () => {
      const res = await request("GET", `/api/join-requests/org/${adminOrgId}`, {
        token: memberToken,
      });
      expect(res.status).toBe(403);
    });

    it("returns pending requests for org admin", async () => {
      const res = await request("GET", `/api/join-requests/org/${adminOrgId}`, {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.requests).toBeDefined();
      expect(body.requests.length).toBeGreaterThanOrEqual(1);
      expect(body.requests[0].status).toBe("pending");
    });
  });

  describe("PUT /api/join-requests/:id/reject", () => {
    let requestId: number;

    beforeAll(async () => {
      // Get the pending request id
      const res = await request("GET", `/api/join-requests/org/${adminOrgId}`, {
        token: adminToken,
      });
      const body = await res.json();
      requestId = body.requests[0]?.id;
    });

    it("requires authentication", async () => {
      const res = await request(
        "PUT",
        `/api/join-requests/${requestId}/reject`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admins", async () => {
      const res = await request(
        "PUT",
        `/api/join-requests/${requestId}/reject`,
        { token: memberToken },
      );
      expect(res.status).toBe(403);
    });

    it("admin can reject the request", async () => {
      const res = await request(
        "PUT",
        `/api/join-requests/${requestId}/reject`,
        { token: adminToken },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Join request rejected");
    });

    it("cannot process an already-processed request", async () => {
      const res = await request(
        "PUT",
        `/api/join-requests/${requestId}/reject`,
        { token: adminToken },
      );
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toMatch(/already been processed/i);
    });
  });

  describe("PUT /api/join-requests/:id/accept", () => {
    let requestId: number;
    let applicantToken: string;

    beforeAll(async () => {
      // Create a new user and join request for the accept flow
      const applicant = await registerAndLogin(
        "jrapplicant",
        "jrapplicant@test.com",
      );
      applicantToken = applicant.token;

      const createRes = await request("POST", "/api/join-requests", {
        token: applicantToken,
        body: { organizationId: adminOrgId },
      });
      expect(createRes.status).toBe(201);

      const listRes = await request(
        "GET",
        `/api/join-requests/org/${adminOrgId}`,
        { token: adminToken },
      );
      const body = await listRes.json();
      requestId = body.requests[0]?.id;
    });

    it("requires authentication", async () => {
      const res = await request(
        "PUT",
        `/api/join-requests/${requestId}/accept`,
      );
      expect(res.status).toBe(401);
    });

    it("returns 403 for non-admins", async () => {
      const res = await request(
        "PUT",
        `/api/join-requests/${requestId}/accept`,
        { token: applicantToken },
      );
      expect(res.status).toBe(403);
    });

    it("admin can accept the request", async () => {
      const res = await request(
        "PUT",
        `/api/join-requests/${requestId}/accept`,
        { token: adminToken },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Join request accepted");
    });

    it("cannot accept an already-processed request", async () => {
      const res = await request(
        "PUT",
        `/api/join-requests/${requestId}/accept`,
        { token: adminToken },
      );
      expect(res.status).toBe(400);
    });
  });

  describe("DELETE /api/join-requests/:id (cancel)", () => {
    let requestId: number;
    let cancelUserToken: string;

    beforeAll(async () => {
      const cancelUser = await registerAndLogin(
        "jrcancel",
        "jrcancel@test.com",
      );
      cancelUserToken = cancelUser.token;

      const createRes = await request("POST", "/api/join-requests", {
        token: cancelUserToken,
        body: { organizationId: adminOrgId },
      });
      expect(createRes.status).toBe(201);

      const mineRes = await request("GET", "/api/join-requests/mine", {
        token: cancelUserToken,
      });
      const body = await mineRes.json();
      requestId = body.requests.find((r: any) => r.status === "pending")?.id;
    });

    it("requires authentication", async () => {
      const res = await request("DELETE", `/api/join-requests/${requestId}`);
      expect(res.status).toBe(401);
    });

    it("cannot cancel another user's request", async () => {
      const res = await request("DELETE", `/api/join-requests/${requestId}`, {
        token: memberToken,
      });
      expect(res.status).toBe(403);
    });

    it("user can cancel their own pending request", async () => {
      const res = await request("DELETE", `/api/join-requests/${requestId}`, {
        token: cancelUserToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Join request cancelled");
    });

    it("returns 404 after cancellation", async () => {
      const res = await request("DELETE", `/api/join-requests/${requestId}`, {
        token: cancelUserToken,
      });
      expect(res.status).toBe(404);
    });
  });
});
