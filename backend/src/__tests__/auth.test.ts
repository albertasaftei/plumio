import { describe, it, expect } from "vitest";
import { request, setupAdmin } from "./helpers.js";

describe("Auth API", () => {
  // Shared token from the first successful login — avoids duplicate
  // JWT issues when the same user logs in multiple times in the same second.
  let adminToken: string;

  describe("GET /api/auth/check-setup", () => {
    it("returns needsSetup: true when no users exist", async () => {
      const res = await request("GET", "/api/auth/check-setup");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.needsSetup).toBe(true);
    });
  });

  describe("POST /api/auth/setup", () => {
    it("creates the initial admin user", async () => {
      const res = await request("POST", "/api/auth/setup", {
        body: {
          username: "testadmin",
          email: "admin@test.com",
          password: "password123",
          organizationName: "Test Org",
        },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Setup completed successfully");
    });

    it("rejects setup if already completed", async () => {
      const res = await request("POST", "/api/auth/setup", {
        body: {
          username: "another",
          email: "another@test.com",
          password: "password123",
        },
      });
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Setup already completed");
    });
  });

  describe("GET /api/auth/check-setup (after setup)", () => {
    it("returns needsSetup: false", async () => {
      const res = await request("GET", "/api/auth/check-setup");
      const body = await res.json();
      expect(body.needsSetup).toBe(false);
    });
  });

  describe("POST /api/auth/login", () => {
    it("returns a token on valid credentials", async () => {
      const res = await request("POST", "/api/auth/login", {
        body: { username: "testadmin", password: "password123" },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(body.username).toBe("testadmin");
      expect(body.isAdmin).toBe(false); // first user via setup doesn't set is_admin flag
      expect(body.currentOrganization).toBeDefined();
      expect(body.currentOrganization.name).toBe("Test Org");
      // Save for reuse by validate/logout tests
      adminToken = body.token;
    });

    it("returns 401 on wrong password", async () => {
      const res = await request("POST", "/api/auth/login", {
        body: { username: "testadmin", password: "wrongpassword" },
      });
      expect(res.status).toBe(401);
    });

    it("returns 401 on nonexistent user", async () => {
      const res = await request("POST", "/api/auth/login", {
        body: { username: "noone", password: "password123" },
      });
      expect(res.status).toBe(401);
    });

    it("returns 400 on short password", async () => {
      const res = await request("POST", "/api/auth/login", {
        body: { username: "testadmin", password: "short" },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/auth/validate", () => {
    it("returns valid: true with a valid token", async () => {
      const res = await request("GET", "/api/auth/validate", {
        token: adminToken,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.valid).toBe(true);
      expect(body.username).toBe("testadmin");
    });

    it("returns 401 with an invalid token", async () => {
      const res = await request("GET", "/api/auth/validate", {
        token: "invalid-token",
      });
      expect(res.status).toBe(401);
    });

    it("returns 401 with no token", async () => {
      const res = await request("GET", "/api/auth/validate");
      expect(res.status).toBe(401);
    });
  });

  describe("POST /api/auth/logout", () => {
    it("invalidates the session", async () => {
      // Use a different user to get a unique token
      await request("POST", "/api/auth/register", {
        body: {
          username: "logoutuser",
          email: "logout@test.com",
          password: "password123",
        },
      });
      const loginRes = await request("POST", "/api/auth/login", {
        body: { username: "logoutuser", password: "password123" },
      });
      const { token } = await loginRes.json();

      // Logout
      const logoutRes = await request("POST", "/api/auth/logout", { token });
      expect(logoutRes.status).toBe(200);

      // Token should no longer work
      const validateRes = await request("GET", "/api/auth/validate", { token });
      expect(validateRes.status).toBe(401);
    });
  });

  describe("POST /api/auth/register", () => {
    it("creates a new user when registration is enabled", async () => {
      const res = await request("POST", "/api/auth/register", {
        body: {
          username: "newuser",
          email: "new@test.com",
          password: "password123",
        },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Registration successful. Please login.");
    });

    it("new user can login", async () => {
      const res = await request("POST", "/api/auth/login", {
        body: { username: "newuser", password: "password123" },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(body.username).toBe("newuser");
    });

    it("rejects duplicate username", async () => {
      const res = await request("POST", "/api/auth/register", {
        body: {
          username: "newuser",
          email: "different@test.com",
          password: "password123",
        },
      });
      expect(res.status).toBe(400);
    });

    it("rejects duplicate email", async () => {
      const res = await request("POST", "/api/auth/register", {
        body: {
          username: "different",
          email: "new@test.com",
          password: "password123",
        },
      });
      expect(res.status).toBe(400);
    });
  });

  describe("PUT /api/auth/profile", () => {
    it("updates the username and returns a new token", async () => {
      // Register + login a user for this test
      await request("POST", "/api/auth/register", {
        body: {
          username: "profileuser",
          email: "profile@test.com",
          password: "password123",
        },
      });
      const loginRes = await request("POST", "/api/auth/login", {
        body: { username: "profileuser", password: "password123" },
      });
      const { token } = await loginRes.json();

      const res = await request("PUT", "/api/auth/profile", {
        token,
        body: { username: "profileuser_updated" },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.token).toBeDefined();
      expect(body.message).toBe("Profile updated successfully");

      // Verify new token works
      const validateRes = await request("GET", "/api/auth/validate", {
        token: body.token,
      });
      expect(validateRes.status).toBe(200);
      const valBody = await validateRes.json();
      expect(valBody.username).toBe("profileuser_updated");
    });
  });
});

describe("Public endpoints", () => {
  describe("GET /api/health", () => {
    it("returns ok status", async () => {
      const res = await request("GET", "/api/health");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.status).toBe("ok");
      expect(body.appVersion).toBeDefined();
    });
  });

  describe("GET /api/config", () => {
    it("returns config object", async () => {
      const res = await request("GET", "/api/config");
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(typeof body).toBe("object");
    });
  });
});
