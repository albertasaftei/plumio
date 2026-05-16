import { Hono } from "hono";
import { documentQueries, tagQueries } from "../../db/index.js";
import {
  combinedAuthMiddleware,
  requirePermission,
  requireAnyPermission,
} from "../../middlewares/auth.js";
import { UserJWTPayload } from "../../middlewares/auth.types.js";
import {
  createTagSchema,
  updateTagSchema,
  setDocumentTagsSchema,
  bulkTagSchema,
} from "./helpers/schemas.js";
import { deliverWebhook } from "../../utils/webhooks.js";

// Neutral gray used as the display fallback when a tag has no color assigned
const DEFAULT_TAG_COLOR = "#6b7280";

type Variables = {
  user: UserJWTPayload;
};

const tagsRouter = new Hono<{ Variables: Variables }>();

tagsRouter.use("*", combinedAuthMiddleware);

// List all tags for the current user + org (with document counts)
tagsRouter.get("/", requirePermission("tags:read"), (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }
  const tags = tagQueries.listByUserAndOrg.all(user.userId, user.currentOrgId);
  return c.json({ tags });
});

// Create a new tag
tagsRouter.post("/", requirePermission("tags:create"), async (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  const body = await c.req.json();
  const parsed = createTagSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid input", details: parsed.error.issues },
      400,
    );
  }

  const { name, color, description } = parsed.data;

  // Check uniqueness
  const existing = tagQueries.findByName.get(
    user.userId,
    user.currentOrgId,
    name,
  );
  if (existing) {
    return c.json({ error: "A tag with this name already exists" }, 409);
  }

  try {
    const result = tagQueries.create.run(
      user.userId,
      user.currentOrgId,
      name,
      color ?? null,
      description ?? null,
    );
    const tag = tagQueries.findById.get(
      Number(result.lastInsertRowid),
      user.userId,
    );
    deliverWebhook(user.currentOrgId, "tag.created", {
      id: tag?.id,
      name: tag?.name,
      color: tag?.color ?? DEFAULT_TAG_COLOR,
    });
    return c.json({ tag }, 201);
  } catch (error) {
    return c.json({ error: "Failed to create tag" }, 500);
  }
});

// Update a tag
tagsRouter.put("/:id", requirePermission("tags:update"), async (c) => {
  const user = c.get("user");
  const tagId = parseInt(c.req.param("id"), 10);
  if (isNaN(tagId)) {
    return c.json({ error: "Invalid tag ID" }, 400);
  }

  const existing = tagQueries.findById.get(tagId, user.userId);
  if (!existing) {
    return c.json({ error: "Tag not found" }, 404);
  }

  const body = await c.req.json();
  const parsed = updateTagSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Invalid input", details: parsed.error.issues },
      400,
    );
  }

  const name = parsed.data.name ?? existing.name;
  const color =
    parsed.data.color !== undefined ? parsed.data.color : existing.color;
  const description =
    parsed.data.description !== undefined
      ? parsed.data.description
      : existing.description;

  // Check uniqueness if name changed
  if (name !== existing.name) {
    const duplicate = tagQueries.findByName.get(
      user.userId,
      existing.organization_id,
      name,
    );
    if (duplicate) {
      return c.json({ error: "A tag with this name already exists" }, 409);
    }
  }

  tagQueries.update.run(name, color, description, tagId, user.userId);
  const updated = tagQueries.findById.get(tagId, user.userId);
  if (updated && user.currentOrgId) {
    deliverWebhook(user.currentOrgId, "tag.updated", {
      id: updated.id,
      name: updated.name,
      color: updated.color ?? DEFAULT_TAG_COLOR,
    });
  }
  return c.json({ tag: updated });
});

// Delete a tag
tagsRouter.delete("/:id", requirePermission("tags:delete"), (c) => {
  const user = c.get("user");
  const tagId = parseInt(c.req.param("id"), 10);
  if (isNaN(tagId)) {
    return c.json({ error: "Invalid tag ID" }, 400);
  }

  const existing = tagQueries.findById.get(tagId, user.userId);
  if (!existing) {
    return c.json({ error: "Tag not found" }, 404);
  }

  tagQueries.delete.run(tagId, user.userId);
  if (user.currentOrgId) {
    deliverWebhook(user.currentOrgId, "tag.deleted", {
      id: existing.id,
      name: existing.name,
    });
  }
  return c.json({ message: "Tag deleted" });
});

// Get documents for a tag
tagsRouter.get("/:id/documents", requirePermission("tags:read"), (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }
  const tagId = parseInt(c.req.param("id"), 10);
  if (isNaN(tagId)) {
    return c.json({ error: "Invalid tag ID" }, 400);
  }

  const tag = tagQueries.findById.get(tagId, user.userId);
  if (!tag) {
    return c.json({ error: "Tag not found" }, 404);
  }

  const docIds = tagQueries.getDocumentIdsForTag.all(tagId);
  const documents = docIds
    .map((row) => {
      // Look up document by ID — we need a query for this
      const allDocs = documentQueries.listByOrganization.all(
        user.currentOrgId!,
      );
      return allDocs.find((d) => d.id === row.document_id);
    })
    .filter(Boolean);

  return c.json({ documents });
});

// Get tags for a specific document (by path)
tagsRouter.get("/document", requirePermission("tags:read"), (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }
  const docPath = c.req.query("path");
  if (!docPath) {
    return c.json({ error: "Path is required" }, 400);
  }

  const doc = documentQueries.findByOrgAndPath.get(user.currentOrgId, docPath);
  if (!doc) {
    return c.json({ tags: [] });
  }

  const tags = tagQueries.getTagsForDocument.all(doc.id, user.userId);
  return c.json({ tags });
});

// Set tags for a document (replace all)
tagsRouter.post(
  "/document",
  requireAnyPermission(["tags:create", "tags:update"]),
  async (c) => {
    const user = c.get("user");
    if (!user.currentOrgId) {
      return c.json({ error: "No organization selected" }, 400);
    }

    const body = await c.req.json();
    const parsed = setDocumentTagsSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid input", details: parsed.error.issues },
        400,
      );
    }

    const doc = documentQueries.findByOrgAndPath.get(
      user.currentOrgId,
      parsed.data.path,
    );
    if (!doc) {
      return c.json({ error: "Document not found" }, 404);
    }

    // Verify all tag IDs belong to this user
    for (const tagId of parsed.data.tagIds) {
      const tag = tagQueries.findById.get(tagId, user.userId);
      if (!tag) {
        return c.json({ error: `Tag ${tagId} not found` }, 404);
      }
    }

    // Capture old tags before update for diffing
    const oldTags = tagQueries.getTagsForDocument.all(doc.id, user.userId);
    const oldTagIds = new Set(oldTags.map((t) => t.id));
    const newTagIds = new Set(parsed.data.tagIds);

    tagQueries.setDocumentTags(doc.id, parsed.data.tagIds);

    const tags = tagQueries.getTagsForDocument.all(doc.id, user.userId);

    const added = parsed.data.tagIds.filter((id) => !oldTagIds.has(id));
    const removed = [...oldTagIds].filter((id) => !newTagIds.has(id));
    if (added.length > 0) {
      deliverWebhook(user.currentOrgId, "document.tagged", {
        documentPath: parsed.data.path,
        addedTagIds: added,
      });
    }
    if (removed.length > 0) {
      deliverWebhook(user.currentOrgId, "document.untagged", {
        documentPath: parsed.data.path,
        removedTagIds: removed,
      });
    }

    return c.json({ tags });
  },
);

// Bulk add/remove tag from multiple documents
tagsRouter.post(
  "/bulk",
  requireAnyPermission(["tags:create", "tags:delete"]),
  async (c) => {
    const user = c.get("user");
    if (!user.currentOrgId) {
      return c.json({ error: "No organization selected" }, 400);
    }

    const body = await c.req.json();
    const parsed = bulkTagSchema.safeParse(body);
    if (!parsed.success) {
      return c.json(
        { error: "Invalid input", details: parsed.error.issues },
        400,
      );
    }

    const tag = tagQueries.findById.get(parsed.data.tagId, user.userId);
    if (!tag) {
      return c.json({ error: "Tag not found" }, 404);
    }

    const documentIds: number[] = [];
    for (const docPath of parsed.data.documentPaths) {
      const doc = documentQueries.findByOrgAndPath.get(
        user.currentOrgId,
        docPath,
      );
      if (doc) {
        documentIds.push(doc.id);
      }
    }

    if (parsed.data.action === "add") {
      tagQueries.bulkAddTag(documentIds, parsed.data.tagId);
    } else {
      tagQueries.bulkRemoveTag(documentIds, parsed.data.tagId);
    }

    return c.json({
      message: `Tag ${parsed.data.action === "add" ? "added to" : "removed from"} ${documentIds.length} documents`,
    });
  },
);

// Get all document-tag mappings for the current user+org (for sidebar filtering)
tagsRouter.get("/mappings", requirePermission("tags:read"), (c) => {
  const user = c.get("user");
  if (!user.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  const mappings = tagQueries.getAllDocumentTagMappings.all(
    user.userId,
    user.currentOrgId,
  );

  // Also return a map of document_id -> path for the frontend to use
  const allDocs = documentQueries.listByOrganization.all(user.currentOrgId);
  const docIdToPath: Record<number, string> = {};
  for (const doc of allDocs) {
    docIdToPath[doc.id] = doc.path;
  }

  // Convert to path-based mappings
  const pathMappings: Record<string, number[]> = {};
  for (const m of mappings) {
    const path = docIdToPath[m.document_id];
    if (path) {
      if (!pathMappings[path]) {
        pathMappings[path] = [];
      }
      pathMappings[path].push(m.tag_id);
    }
  }

  return c.json({ mappings: pathMappings });
});

export { tagsRouter };
