import { describe, it, expect, beforeAll } from "vitest";
import { request, setupAdmin, registerAndLogin } from "./helpers.js";

// ─── Shared state ────────────────────────────────────────────────────────────

let adminToken: string;
let adminOrgId: number;

// Second org created by a second user, then admin is added as member
let secondUserToken: string;
let secondOrgId: number;

// Admin's token after switching into the second org
let adminTokenInSecondOrg: string;

// ─── Setup ───────────────────────────────────────────────────────────────────

beforeAll(async () => {
  // Use default credentials — works whether DB is fresh or shared across files
  const admin = await setupAdmin();
  adminToken = admin.token;
  adminOrgId = admin.currentOrganization.id;

  // Register a second user (gets their own org automatically)
  const secondUser = await registerAndLogin("moveuser", "moveuser@test.com");
  secondUserToken = secondUser.token;
  secondOrgId = secondUser.currentOrganization.id;

  // Add admin as a member of the second org
  await request("POST", `/api/organizations/${secondOrgId}/members`, {
    token: secondUserToken,
    body: { username: "testadmin", role: "member" },
  });

  // Switch admin's context into the second org to get a token scoped to it
  const switchRes = await request(
    "POST",
    `/api/organizations/${secondOrgId}/switch`,
    { token: adminToken },
  );
  const switchBody = await switchRes.json();
  adminTokenInSecondOrg = switchBody.token;

  // The switch invalidates the old session — re-login to get a fresh adminToken
  const readmin = await setupAdmin();
  adminToken = readmin.token;
});

// ─── POST /api/documents/move ─────────────────────────────────────────────────

describe("POST /api/documents/move", () => {
  beforeAll(async () => {
    // Seed documents used across the describe block
    await request("POST", "/api/documents/save", {
      token: adminToken,
      body: {
        folder: "/",
        name: "Move Source",
        content: "# Move Source",
        isNew: true,
      },
    });

    await request("POST", "/api/documents/folder", {
      token: adminToken,
      body: { folder: "/", name: "Move Target Folder" },
    });

    await request("POST", "/api/documents/save", {
      token: adminToken,
      body: {
        folder: "/",
        name: "Conflict Doc",
        content: "# Conflict Doc",
        isNew: true,
      },
    });

    // Place a same-named file in Move Target Folder to test conflict
    await request("POST", "/api/documents/save", {
      token: adminToken,
      body: {
        folder: "/Move Target Folder",
        name: "Conflict Doc",
        content: "# Conflict Doc",
        isNew: true,
      },
    });
  });

  it("moves a file into a folder", async () => {
    const res = await request("POST", "/api/documents/move", {
      token: adminToken,
      body: {
        sourcePath: "/Move Source.md",
        destinationFolder: "/Move Target Folder",
      },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.newPath).toBe("/Move Target Folder/Move Source.md");
  });

  it("moved file appears in the target folder", async () => {
    const res = await request(
      "GET",
      "/api/documents/list?path=/Move Target Folder",
      { token: adminToken },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.items.find((i: any) => i.name === "Move Source.md");
    expect(found).toBeDefined();
  });

  it("moved file is gone from source location", async () => {
    const res = await request("GET", "/api/documents/list?path=/", {
      token: adminToken,
    });
    const body = await res.json();
    const still = body.items.find((i: any) => i.name === "Move Source.md");
    expect(still).toBeUndefined();
  });

  it("returns 409 when destination already has a file with the same name", async () => {
    const res = await request("POST", "/api/documents/move", {
      token: adminToken,
      body: {
        sourcePath: "/Conflict Doc.md",
        destinationFolder: "/Move Target Folder",
      },
    });
    expect(res.status).toBe(409);
  });

  it("returns 400 when trying to move a folder into itself", async () => {
    // Create a folder to test self-move guard
    await request("POST", "/api/documents/folder", {
      token: adminToken,
      body: { folder: "/", name: "Self Move Folder" },
    });

    const res = await request("POST", "/api/documents/move", {
      token: adminToken,
      body: {
        sourcePath: "/Self Move Folder",
        destinationFolder: "/Self Move Folder",
      },
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await request("POST", "/api/documents/move", {
      body: { sourcePath: "/Anything.md", destinationFolder: "/" },
    });
    expect(res.status).toBe(401);
  });
});

// ─── POST /api/documents/move-cross-org ──────────────────────────────────────

describe("POST /api/documents/move-cross-org", () => {
  beforeAll(async () => {
    // Seed a file in admin's primary org for cross-org move tests
    await request("POST", "/api/documents/save", {
      token: adminToken,
      body: {
        folder: "/",
        name: "Cross Org Doc",
        content: "# Cross Org Doc\n\nShared content",
        isNew: true,
      },
    });

    // Seed a file that will collide in the second org
    await request("POST", "/api/documents/save", {
      token: adminTokenInSecondOrg,
      body: {
        folder: "/",
        name: "Collision Doc",
        content: "# Collision Doc",
        isNew: true,
      },
    });

    // Also seed the source for the collision test in admin's primary org
    await request("POST", "/api/documents/save", {
      token: adminToken,
      body: {
        folder: "/",
        name: "Collision Doc",
        content: "# Collision Doc source",
        isNew: true,
      },
    });
  });

  it("moves a file to the root of another org", async () => {
    const res = await request("POST", "/api/documents/move-cross-org", {
      token: adminToken,
      body: { sourcePath: "/Cross Org Doc.md", targetOrgId: secondOrgId },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.newPath).toBe("/Cross Org Doc.md");
    expect(body.targetOrgId).toBe(secondOrgId);
  });

  it("file appears in the target org after move", async () => {
    const res = await request("GET", "/api/documents/list?path=/", {
      token: adminTokenInSecondOrg,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    const found = body.items.find((i: any) => i.name === "Cross Org Doc.md");
    expect(found).toBeDefined();
  });

  it("file is gone from source org after move", async () => {
    const res = await request("GET", "/api/documents/list?path=/", {
      token: adminToken,
    });
    const body = await res.json();
    const still = body.items.find((i: any) => i.name === "Cross Org Doc.md");
    expect(still).toBeUndefined();
  });

  it("returns 409 when a file with same name already exists in target org", async () => {
    const res = await request("POST", "/api/documents/move-cross-org", {
      token: adminToken,
      body: { sourcePath: "/Collision Doc.md", targetOrgId: secondOrgId },
    });
    expect(res.status).toBe(409);
  });

  it("returns 400 when targetOrgId equals the current org", async () => {
    const res = await request("POST", "/api/documents/move-cross-org", {
      token: adminToken,
      body: { sourcePath: "/Conflict Doc.md", targetOrgId: adminOrgId },
    });
    expect(res.status).toBe(400);
  });

  it("returns 403 when user is not a member of the target org", async () => {
    // secondUserToken is only in secondOrgId, not in adminOrgId
    const res = await request("POST", "/api/documents/move-cross-org", {
      token: secondUserToken,
      body: { sourcePath: "/Cross Org Doc.md", targetOrgId: adminOrgId },
    });
    expect(res.status).toBe(403);
  });

  it("returns 400 for missing sourcePath", async () => {
    const res = await request("POST", "/api/documents/move-cross-org", {
      token: adminToken,
      body: { targetOrgId: secondOrgId },
    });
    expect(res.status).toBe(400);
  });

  it("returns 401 without auth", async () => {
    const res = await request("POST", "/api/documents/move-cross-org", {
      body: { sourcePath: "/Anything.md", targetOrgId: secondOrgId },
    });
    expect(res.status).toBe(401);
  });
});
