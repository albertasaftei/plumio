import { describe, it, expect, beforeAll } from "vitest";
import { request, setupAdmin } from "./helpers.js";
import fs from "fs";
import path from "path";

let token: string;
let orgId: number;

beforeAll(async () => {
  const admin = await setupAdmin();
  token = admin.token;
  orgId = admin.currentOrganization.id;

  // Create a document for attachment association
  await request("POST", "/api/documents/save", {
    token,
    body: {
      folder: "/",
      name: "With Attachments",
      content: "# With Attachments\n\nDoc with files",
      isNew: true,
    },
  });
});

describe("Attachments API", () => {
  let uploadedFilename: string;
  let uploadedRelPath: string;

  describe("POST /api/attachments/upload", () => {
    it("uploads a file", async () => {
      const fileContent = "Hello, this is a test file.";
      const blob = new Blob([fileContent], { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", blob, "test.txt");
      formData.append("documentPath", "/With Attachments.md");

      const res = await (
        await import("../app.js")
      ).app.request("/api/attachments/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.filename).toBeDefined();
      expect(body.originalName).toBe("test.txt");
      uploadedFilename = body.filename;
      uploadedRelPath = body.path;
    });

    it("rejects upload without file", async () => {
      const formData = new FormData();
      formData.append("documentPath", "/With Attachments.md");

      const res = await (
        await import("../app.js")
      ).app.request("/api/attachments/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/attachments/list", () => {
    it("lists attachments for a document", async () => {
      const res = await request(
        "GET",
        "/api/attachments/list?documentPath=/With Attachments.md",
        { token },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.attachments).toBeDefined();
      expect(body.attachments.length).toBe(1);
      expect(body.attachments[0].original_name).toBe("test.txt");
    });

    it("requires documentPath", async () => {
      const res = await request("GET", "/api/attachments/list", { token });
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/attachments/file", () => {
    it("downloads an attachment", async () => {
      const res = await request(
        "GET",
        `/api/attachments/file?path=${encodeURIComponent(uploadedRelPath)}`,
        { token },
      );
      expect(res.status).toBe(200);
      const text = await res.text();
      expect(text).toBe("Hello, this is a test file.");
    });

    it("supports token query param auth", async () => {
      const res = await request(
        "GET",
        `/api/attachments/file?path=${encodeURIComponent(uploadedRelPath)}&token=${token}`,
      );
      expect(res.status).toBe(200);
    });
  });

  describe("DELETE /api/attachments/delete", () => {
    it("deletes an attachment", async () => {
      const res = await request(
        "DELETE",
        `/api/attachments/delete?path=${encodeURIComponent(uploadedRelPath)}`,
        { token },
      );
      expect(res.status).toBe(200);
    });

    it("attachment no longer in list", async () => {
      const res = await request(
        "GET",
        "/api/attachments/list?documentPath=/With Attachments.md",
        { token },
      );
      const body = await res.json();
      expect(body.attachments.length).toBe(0);
    });
  });
});
