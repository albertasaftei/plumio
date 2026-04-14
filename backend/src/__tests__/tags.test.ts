import { describe, it, expect, beforeAll } from "vitest";
import { request, setupAdmin } from "./helpers.js";

let token: string;

beforeAll(async () => {
  const admin = await setupAdmin();
  token = admin.token;

  // Create a document so we can tag it
  await request("POST", "/api/documents/save", {
    token,
    body: {
      folder: "/",
      name: "Tagged Doc",
      content: "# Tagged Doc\n\nContent to tag",
      isNew: true,
    },
  });
});

describe("Tags API", () => {
  let tagId: number;

  describe("POST /api/tags", () => {
    it("creates a new tag", async () => {
      const res = await request("POST", "/api/tags", {
        token,
        body: { name: "important", color: "#ff0000" },
      });
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.tag).toBeDefined();
      expect(body.tag.name).toBe("important");
      expect(body.tag.color).toBe("#ff0000");
      tagId = body.tag.id;
    });

    it("rejects duplicate tag name", async () => {
      const res = await request("POST", "/api/tags", {
        token,
        body: { name: "important" },
      });
      expect(res.status).toBe(409);
    });

    it("creates a second tag", async () => {
      const res = await request("POST", "/api/tags", {
        token,
        body: { name: "review", color: "#00ff00", description: "Needs review" },
      });
      expect(res.status).toBe(201);
    });
  });

  describe("GET /api/tags", () => {
    it("lists all tags with counts", async () => {
      const res = await request("GET", "/api/tags", { token });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tags).toBeDefined();
      expect(body.tags.length).toBeGreaterThanOrEqual(2);
    });

    it("returns 401 without auth", async () => {
      const res = await request("GET", "/api/tags");
      expect(res.status).toBe(401);
    });
  });

  describe("PUT /api/tags/:id", () => {
    it("updates a tag", async () => {
      const res = await request("PUT", `/api/tags/${tagId}`, {
        token,
        body: { name: "critical", color: "#cc0000" },
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tag.name).toBe("critical");
    });

    it("returns 404 for nonexistent tag", async () => {
      const res = await request("PUT", "/api/tags/99999", {
        token,
        body: { name: "nope" },
      });
      expect(res.status).toBe(404);
    });
  });

  describe("POST /api/tags/document", () => {
    it("assigns tags to a document", async () => {
      const res = await request("POST", "/api/tags/document", {
        token,
        body: {
          path: "/Tagged Doc.md",
          tagIds: [tagId],
        },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/tags/document", () => {
    it("returns tags for a document", async () => {
      const res = await request(
        "GET",
        "/api/tags/document?path=/Tagged Doc.md",
        { token },
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tags).toBeDefined();
      expect(body.tags.length).toBe(1);
      expect(body.tags[0].name).toBe("critical");
    });

    it("returns empty array for untagged document", async () => {
      // Create an untagged doc
      await request("POST", "/api/documents/save", {
        token,
        body: {
          folder: "/",
          name: "Untagged",
          content: "# Untagged",
          isNew: true,
        },
      });

      const res = await request("GET", "/api/tags/document?path=/Untagged.md", {
        token,
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.tags).toEqual([]);
    });
  });

  describe("DELETE /api/tags/:id", () => {
    it("deletes a tag", async () => {
      const res = await request("DELETE", `/api/tags/${tagId}`, { token });
      expect(res.status).toBe(200);
    });

    it("tag no longer appears in list", async () => {
      const res = await request("GET", "/api/tags", { token });
      const body = await res.json();
      const found = body.tags.find((t: any) => t.id === tagId);
      expect(found).toBeUndefined();
    });
  });
});
