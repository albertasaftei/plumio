import { describe, it, expect } from "vitest";
import { app } from "../app.js";
import { request, setupAdmin, registerAndLogin } from "./helpers.js";

describe("API key ban enforcement", () => {
  it("denies banned organization and globally banned users across org routes", async () => {
    const admin = await setupAdmin();
    const adminOrgId = admin.currentOrganization.id;
    const member = await registerAndLogin(
      "bannedkeymember",
      "bannedkeymember@test.com",
    );
    const memberOrgId = member.currentOrganization.id;

    const addMemberRes = await request(
      "POST",
      `/api/organizations/${adminOrgId}/members`,
      { token: admin.token, body: { username: "bannedkeymember", role: "member" } },
    );
    expect(addMemberRes.status).toBe(200);

    const validateRes = await request("GET", "/api/auth/validate", {
      token: member.token,
    });
    const { userId } = await validateRes.json();

    await request("POST", "/api/documents/save", {
      token: admin.token,
      body: {
        folder: "/",
        name: "Private note",
        content: "PRIVATE_ORG_CONTENT",
        isNew: true,
      },
    });

    const keyRes = await request("POST", "/api/api-keys", {
      token: member.token,
      body: {
        name: "organization access",
        permissions: ["documents:read", "documents:create"],
      },
    });
    expect(keyRes.status).toBe(201);
    const { apiKey } = await keyRes.json();

    const attachmentForm = new FormData();
    attachmentForm.append(
      "file",
      new Blob(["private attachment"], { type: "text/plain" }),
      "private.txt",
    );
    attachmentForm.append("documentPath", "/Private note.md");
    const uploadRes = await app.request("/api/attachments/upload", {
      method: "POST",
      headers: { Authorization: `Bearer ${admin.token}` },
      body: attachmentForm,
    });
    expect(uploadRes.status).toBe(200);
    const { path: attachmentPath } = await uploadRes.json();

    const preBanRead = await request(
      "GET",
      "/api/documents/content?path=%2FPrivate%20note.md",
      { token: apiKey.key, headers: { "X-Org-Id": String(adminOrgId) } },
    );
    expect(preBanRead.status).toBe(200);
    expect(await preBanRead.text()).toContain("PRIVATE_ORG_CONTENT");

    const preBanAttachmentRead = await request(
      "GET",
      `/api/attachments/file?path=${encodeURIComponent(attachmentPath)}`,
      { token: apiKey.key, headers: { "X-Org-Id": String(memberOrgId) } },
    );
    expect(preBanAttachmentRead.status).toBe(200);

    const banRes = await request(
      "PUT",
      `/api/organizations/${adminOrgId}/members/${userId}/ban`,
      { token: admin.token, body: { isBanned: true } },
    );
    expect(banRes.status).toBe(200);

    const bannedRead = await request(
      "GET",
      "/api/documents/content?path=%2FPrivate%20note.md",
      { token: apiKey.key, headers: { "X-Org-Id": String(adminOrgId) } },
    );
    expect(bannedRead.status).toBe(403);

    const bannedWrite = await request("POST", "/api/documents/save", {
      token: apiKey.key,
      headers: { "X-Org-Id": String(adminOrgId) },
      body: {
        folder: "/",
        name: "Unauthorized write",
        content: "should not be saved",
        isNew: true,
      },
    });
    expect(bannedWrite.status).toBe(403);

    const bannedAttachmentRead = await request(
      "GET",
      `/api/attachments/file?path=${encodeURIComponent(attachmentPath)}`,
      { token: apiKey.key, headers: { "X-Org-Id": String(memberOrgId) } },
    );
    expect(bannedAttachmentRead.status).toBe(403);

    await request("POST", "/api/documents/save", {
      token: member.token,
      body: {
        folder: "/",
        name: "Move into banned org",
        content: "member-owned source",
        isNew: true,
      },
    });
    const crossOrgMove = await request(
      "POST",
      "/api/documents/move-cross-org",
      {
        token: member.token,
        body: {
          sourcePath: "/Move into banned org.md",
          targetOrgId: adminOrgId,
        },
      },
    );
    expect(crossOrgMove.status).toBe(403);

    const bannedRoleRead = await request(
      "GET",
      `/api/organizations/${adminOrgId}/role`,
      { token: member.token },
    );
    expect(bannedRoleRead.status).toBe(404);

    const globalBanRes = await request(
      "PUT",
      `/api/auth/admin/users/${userId}/ban`,
      { token: admin.token, body: { isBanned: true } },
    );
    expect(globalBanRes.status).toBe(200);

    const globallyBannedKeyRead = await request(
      "GET",
      "/api/documents/list",
      { token: apiKey.key, headers: { "X-Org-Id": String(memberOrgId) } },
    );
    expect(globallyBannedKeyRead.status).toBe(401);
  });
});