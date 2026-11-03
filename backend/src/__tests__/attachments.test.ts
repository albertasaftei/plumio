import { describe, it, expect, beforeAll } from "vitest";
import { request, setupAdmin } from "./helpers.js";
import fs from "fs";
import path from "path";
import { attachmentQueries, db } from "../db/index.js";

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

    it("rejects SVG uploads", async () => {
      const formData = new FormData();
      formData.append(
        "file",
        new Blob(["<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"], {
          type: "image/svg+xml",
        }),
        "image.svg",
      );
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
      expect(res.headers.get("Content-Disposition")).toContain("attachment");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
      const text = await res.text();
      expect(text).toBe("Hello, this is a test file.");
    });

    it("serves legacy SVG attachments as downloads with nosniff", async () => {
      const filename = "legacy.svg";
      const content = "<svg onload=\"alert(document.domain)\"></svg>";
      const attachmentsDir = path.join(
        process.env.DOCUMENTS_PATH || "./documents",
        `org-${orgId}`,
        "attachments",
      );
      fs.mkdirSync(attachmentsDir, { recursive: true });
      fs.writeFileSync(path.join(attachmentsDir, filename), content);

      const user = db
        .prepare<[string], { id: number }>(
          "SELECT id FROM users WHERE username = ?",
        )
        .get("testadmin");
      if (!user) throw new Error("Test admin user not found");

      attachmentQueries.insert.run(
        orgId,
        "/Legacy.md",
        filename,
        filename,
        "image/svg+xml",
        Buffer.byteLength(content),
        user.id,
      );

      const res = await request(
        "GET",
        `/api/attachments/file?path=${encodeURIComponent(`org-${orgId}/attachments/${filename}`)}`,
        { token },
      );

      expect(res.status).toBe(200);
      expect(res.headers.get("Content-Type")).toBe("image/svg+xml");
      expect(res.headers.get("Content-Disposition")).toContain("attachment");
      expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
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
