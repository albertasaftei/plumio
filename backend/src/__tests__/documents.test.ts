import { describe, it, expect, beforeAll } from "vitest";
import { request, setupAdmin } from "./helpers.js";

let token: string;
let orgId: number;

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
