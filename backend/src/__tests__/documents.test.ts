import { describe, it, expect, beforeAll } from "vitest";
import fs from "fs/promises";
import path from "path";
import { createGzip } from "zlib";
import { pack } from "tar-stream";
import { app } from "../app.js";
import { ENABLE_ENCRYPTION } from "../config.js";
import { encrypt } from "../routes/documents/helpers/encryption.js";
import { getOrgDocumentsPath } from "../routes/documents/helpers/paths.js";
import { request, setupAdmin } from "./helpers.js";

let token: string;
let orgId: number;

type ArchiveTestEntry = {
  name: string;
  type?: "file" | "directory" | "symlink";
  content?: string;
  linkname?: string;
};

function createArchive(entries: ArchiveTestEntry[]): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = pack();
    const gzip = createGzip();
    const chunks: Buffer[] = [];

    archive.on("error", reject);
    gzip.on("error", reject);
    gzip.on("data", (chunk: Buffer) => chunks.push(chunk));
    gzip.on("end", () => resolve(Buffer.concat(chunks)));
    archive.pipe(gzip);

    for (const entry of entries) {
      if (entry.type === "symlink") {
        archive.entry({
          name: entry.name,
          type: "symlink",
          linkname: entry.linkname,
        });
      } else if (entry.type === "directory") {
        archive.entry({ name: entry.name, type: "directory" });
      } else {
        const content = Buffer.from(entry.content ?? "");
        archive.entry(
          { name: entry.name, type: "file", size: content.length },
          content,
        );
      }
    }
    archive.finalize();
  });
}

async function importArchive(archive: Buffer) {
  const form = new FormData();
  form.append(
    "file",
    new File([archive], "documents.tar.gz", { type: "application/gzip" }),
  );
  return app.request("/api/documents/import", {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  });
}

beforeAll(async () => {
  const admin = await setupAdmin();
  token = admin.token;
  orgId = admin.currentOrganization.id;
});

describe("Documents API", () => {
  describe("POST /api/documents/save", () => {
    it("creates a new document", async () => {
      const res = await request("POST", "/api/documents/save", {
        token,
        body: {
          folder: "/",
          name: "Test Document",
          content: "# Test Document\n\nHello world",
          isNew: true,
        },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Document saved successfully");
      expect(body.path).toContain("Test Document");
    });

    it("updates an existing document", async () => {
      const res = await request("POST", "/api/documents/save", {
        token,
        body: {
          path: "/Test Document.md",
          content: "# Test Document\n\nUpdated content",
        },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Document saved successfully");
    });

    it("rejects save without content", async () => {
      const res = await request("POST", "/api/documents/save", {
        token,
        body: {
          path: "/Test Document.md",
          content: "",
        },
      });
      // Empty string is falsy, should still return 400
      expect(res.status).toBe(400);
    });
  });

  describe("GET /api/documents/list", () => {
    it("lists documents in root", async () => {
      const res = await request("GET", "/api/documents/list?path=/", { token });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.items).toBeDefined();
      expect(Array.isArray(body.items)).toBe(true);
      const testDoc = body.items.find((i: any) =>
        i.name.includes("Test Document"),
      );
      expect(testDoc).toBeDefined();
    });

    it("returns 401 without auth", async () => {
      const res = await request("GET", "/api/documents/list?path=/");
      expect(res.status).toBe(401);
    });
  });

  describe("GET /api/documents/content", () => {
    it("returns document content", async () => {
      const res = await request(
        "GET",
        "/api/documents/content?path=/Test Document.md",
        { token },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.content).toContain("Updated content");
    });

    it("returns error for missing path", async () => {
      const res = await request("GET", "/api/documents/content", { token });
      expect(res.status).toBe(400);
    });
  });

  describe("POST /api/documents/import", () => {
    it("imports regular Markdown files", async () => {
      const archive = await createArchive([
        { name: "Imported.md", content: "# Imported safely" },
      ]);
      const res = await importArchive(archive);

      expect(res.status).toBe(200);
      const contentRes = await request(
        "GET",
        "/api/documents/content?path=/Imported.md",
        { token },
      );
      expect(contentRes.status).toBe(200);
      expect((await contentRes.json()).content).toContain("Imported safely");
      const storedContent = await fs.readFile(
        path.join(getOrgDocumentsPath(orgId), "Imported.md"),
        "utf-8",
      );
      if (ENABLE_ENCRYPTION) {
        expect(storedContent).not.toContain("Imported safely");
      } else {
        expect(storedContent).toContain("Imported safely");
      }
    });

    it("encrypts plaintext imports without re-encrypting encrypted files", async () => {
      const encryptedContent = encrypt("# Already encrypted");
      const archive = await createArchive([
        { name: "Plain Import.md", content: "# Plain import" },
        { name: "Encrypted Import.md", content: encryptedContent },
      ]);
      const res = await importArchive(archive);

      expect(res.status).toBe(200);
      for (const [fileName, expectedContent] of [
        ["Plain Import.md", "# Plain import"],
        ["Encrypted Import.md", "# Already encrypted"],
      ]) {
        const contentRes = await request(
          "GET",
          `/api/documents/content?path=/${encodeURIComponent(fileName)}`,
          { token },
        );
        expect(contentRes.status).toBe(200);
        expect((await contentRes.json()).content).toBe(expectedContent);
      }

      if (ENABLE_ENCRYPTION) {
        expect(
          await fs.readFile(
            path.join(getOrgDocumentsPath(orgId), "Encrypted Import.md"),
            "utf-8",
          ),
        ).toBe(encryptedContent);
        expect(
          await fs.readFile(
            path.join(getOrgDocumentsPath(orgId), "Plain Import.md"),
            "utf-8",
          ),
        ).not.toContain("Plain import");
      }
    });

    it("rejects symlink entries without changing outside files", async () => {
      const orgPath = getOrgDocumentsPath(orgId);
      const sentinelPath = path.join(path.dirname(orgPath), `outside-${orgId}.txt`);
      const existingPath = path.join(orgPath, "Import Guard.md");
      await fs.mkdir(orgPath, { recursive: true });
      await fs.writeFile(sentinelPath, "sentinel contents");
      await fs.writeFile(existingPath, "keep existing content");

      const archive = await createArchive([
        { name: "Import Guard.md", content: "attempted overwrite" },
        {
          name: "secret.md",
          type: "symlink",
          linkname: sentinelPath,
        },
      ]);
      const res = await importArchive(archive);

      expect(res.status).toBe(400);
      expect(await fs.readFile(sentinelPath, "utf-8")).toBe(
        "sentinel contents",
      );
      expect(await fs.readFile(existingPath, "utf-8")).toBe(
        "keep existing content",
      );
      await expect(fs.lstat(path.join(orgPath, "secret.md"))).rejects.toMatchObject({
        code: "ENOENT",
      });
    });

    it("rejects traversal and corrupt archives", async () => {
      const orgPath = getOrgDocumentsPath(orgId);
      const escapedPath = path.join(path.dirname(orgPath), `escaped-${orgId}.md`);
      const traversalArchive = await createArchive([
        { name: `../escaped-${orgId}.md`, content: "outside" },
      ]);
      const traversalRes = await importArchive(traversalArchive);
      const corruptRes = await importArchive(Buffer.from("not a gzip archive"));

      expect(traversalRes.status).toBe(400);
      expect(corruptRes.status).toBe(400);
      await expect(fs.lstat(escapedPath)).rejects.toMatchObject({
        code: "ENOENT",
      });
    });

    it("blocks reads and writes through an existing symlink", async () => {
      const orgPath = getOrgDocumentsPath(orgId);
      const sentinelPath = path.join(path.dirname(orgPath), `write-${orgId}.txt`);
      const linkPath = path.join(orgPath, "linked.md");
      await fs.mkdir(orgPath, { recursive: true });
      await fs.writeFile(sentinelPath, "unchanged sentinel");
      await fs.symlink(sentinelPath, linkPath);

      const contentRes = await request(
        "GET",
        "/api/documents/content?path=/linked.md",
        { token },
      );
      const saveRes = await request("POST", "/api/documents/save", {
        token,
        body: { path: "/linked.md", content: "overwritten" },
      });

      expect(contentRes.status).not.toBe(200);
      expect(saveRes.status).not.toBe(200);
      expect(await fs.readFile(sentinelPath, "utf-8")).toBe(
        "unchanged sentinel",
      );
      await fs.unlink(linkPath);
      await fs.unlink(sentinelPath);
    });
  });

  describe("POST /api/documents/folder", () => {
    it("creates a folder", async () => {
      const res = await request("POST", "/api/documents/folder", {
        token,
        body: { folder: "/", name: "Test Folder" },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.message).toBe("Folder created successfully");
    });

    it("folder appears in listing", async () => {
      const res = await request("GET", "/api/documents/list?path=/", { token });
      const body = await res.json();
      const folder = body.items.find((i: any) => i.name === "Test Folder");
      expect(folder).toBeDefined();
      expect(folder.type).toBe("folder");
    });
  });

  describe("POST /api/documents/save (in folder)", () => {
    it("creates a document inside a folder", async () => {
      const res = await request("POST", "/api/documents/save", {
        token,
        body: {
          folder: "/Test Folder",
          name: "Nested Doc",
          content: "# Nested\n\nInside folder",
          isNew: true,
        },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/documents/list (recursive)", () => {
    it("returns all items recursively", async () => {
      const res = await request(
        "GET",
        "/api/documents/list?path=/&recursive=true",
        { token },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      const nested = body.items.find((i: any) => i.path.includes("Nested Doc"));
      expect(nested).toBeDefined();
    });
  });

  describe("POST /api/documents/rename", () => {
    it("renames a document", async () => {
      // Create a doc to rename
      await request("POST", "/api/documents/save", {
        token,
        body: {
          folder: "/",
          name: "Rename Me",
          content: "# Rename Me\n\nContent",
          isNew: true,
        },
      });

      const res = await request("POST", "/api/documents/rename", {
        token,
        body: {
          oldPath: "/Rename Me.md",
          newName: "Renamed Doc",
        },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/documents/color", () => {
    it("sets a document color", async () => {
      const res = await request("POST", "/api/documents/color", {
        token,
        body: {
          path: "/Test Document.md",
          color: "#ff5733",
        },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/documents/duplicate", () => {
    it("duplicates a document", async () => {
      const res = await request("POST", "/api/documents/duplicate", {
        token,
        body: { path: "/Test Document.md" },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.newPath).toBeDefined();
    });
  });

  describe("DELETE /api/documents/delete", () => {
    it("soft-deletes a document", async () => {
      // Create a doc to delete
      await request("POST", "/api/documents/save", {
        token,
        body: {
          folder: "/",
          name: "Delete Me",
          content: "# Delete Me\n\nContent",
          isNew: true,
        },
      });

      const res = await request(
        "DELETE",
        "/api/documents/delete?path=/Delete Me.md",
        { token },
      );
      expect(res.status).toBe(200);

      // Should no longer appear in list
      const listRes = await request("GET", "/api/documents/list?path=/", {
        token,
      });
      const body = await listRes.json();
      const deleted = body.items.find((i: any) => i.name === "Delete Me.md");
      expect(deleted).toBeUndefined();
    });
  });

  describe("GET /api/documents/search", () => {
    it("finds documents by content", async () => {
      const res = await request(
        "GET",
        "/api/documents/search?q=Updated+content",
        { token },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.results).toBeDefined();
    });
  });

  describe("POST /api/documents/archive", () => {
    it("archives a document", async () => {
      await request("POST", "/api/documents/save", {
        token,
        body: {
          folder: "/",
          name: "Archive Me",
          content: "# Archive Me\n\nContent",
          isNew: true,
        },
      });

      const res = await request("POST", "/api/documents/archive", {
        token,
        body: { path: "/Archive Me.md" },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("POST /api/documents/unarchive", () => {
    it("restores an archived document", async () => {
      const res = await request("POST", "/api/documents/unarchive", {
        token,
        body: { path: "/Archive Me.md" },
      });
      expect(res.status).toBe(200);
    });
  });
});
