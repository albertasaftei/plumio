import { Hono } from "hono";
import fs from "fs/promises";
import path from "path";
import { verifyToken } from "../../middlewares/auth.js";
import { attachmentQueries, memberQueries } from "../../db/index.js";
import { UserJWTPayload } from "../../middlewares/auth.types.js";
import { MAX_ATTACHMENT_SIZE_MB } from "../../config.js";
import {
  getAttachmentsDir,
  isAllowedMime,
  getUniqueFilename,
  resolveAttachmentPath,
} from "./helpers/storage.js";

type Variables = {
  user: UserJWTPayload;
};

const attachmentsRouter = new Hono<{ Variables: Variables }>();

// ── Auth middleware (accepts Bearer header OR ?token= query param for <img src>) ──
attachmentsRouter.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  const token =
    authHeader?.replace("Bearer ", "") || c.req.query("token") || "";

  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const user = await verifyToken(token);
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  c.set("user", user);
  await next();
});

// POST /api/attachments/upload
attachmentsRouter.post("/upload", async (c) => {
  const user = c.get("user");
  const organizationId = user.currentOrgId;
  if (!organizationId) return c.json({ error: "No organization context" }, 400);

  const body = await c.req.parseBody();
  const file = body["file"];
  const documentPath = body["documentPath"] as string | undefined;

  if (!file || typeof file === "string") {
    return c.json({ error: "No file provided" }, 400);
  }
  if (!documentPath) {
    return c.json({ error: "documentPath is required" }, 400);
  }

  // Size check
  const maxBytes = MAX_ATTACHMENT_SIZE_MB * 1024 * 1024;
  if (file.size > maxBytes) {
    return c.json(
      { error: `File exceeds maximum size of ${MAX_ATTACHMENT_SIZE_MB} MB` },
      400,
    );
  }

  // MIME check
  const mimeType = file.type || "application/octet-stream";
  if (!isAllowedMime(mimeType)) {
    return c.json({ error: `File type '${mimeType}' is not allowed` }, 400);
  }

  const attachmentsDir = getAttachmentsDir(organizationId);
  await fs.mkdir(attachmentsDir, { recursive: true });

  const uniqueFilename = await getUniqueFilename(attachmentsDir, file.name);
  const destPath = path.join(attachmentsDir, uniqueFilename);

  // Write file
  const buffer = await file.arrayBuffer();
  await fs.writeFile(destPath, Buffer.from(buffer));

  // Record in DB
  attachmentQueries.insert.run(
    organizationId,
    documentPath,
    uniqueFilename,
    file.name,
    mimeType,
    file.size,
    user.userId,
  );

  const relPath = `org-${organizationId}/attachments/${uniqueFilename}`;
  return c.json({
    message: "Attachment uploaded",
    filename: uniqueFilename,
    originalName: file.name,
    path: relPath,
    mimeType,
    size: file.size,
  });
});

// GET /api/attachments/list?documentPath=
attachmentsRouter.get("/list", async (c) => {
  const user = c.get("user");
  const organizationId = user.currentOrgId;
  if (!organizationId) return c.json({ error: "No organization context" }, 400);

  const documentPath = c.req.query("documentPath");
  if (!documentPath) return c.json({ error: "documentPath is required" }, 400);

  const rows = attachmentQueries.listByDocument.all(
    organizationId,
    documentPath,
  );
  return c.json({ attachments: rows });
});

// GET /api/attachments/file?path=org-{id}/attachments/{filename}
// Note: accepts ?token= in addition to Bearer (handled by the global middleware above)
attachmentsRouter.get("/file", async (c) => {
  const user = c.get("user");

  const relPath = c.req.query("path") || "";
  if (!relPath) return c.json({ error: "path is required" }, 400);

  // Extract org ID from path (org-{id}/attachments/{filename}) rather than
  // relying on currentOrgId from the token. This lets any valid user token
  // access attachments from orgs the user is a member of, even if they have
  // since switched their active org (which issues a new token).
  const pathOrgMatch = relPath.match(/^org-(\d+)\/attachments\//);
  if (!pathOrgMatch) return c.json({ error: "Invalid path" }, 400);
  const organizationId = parseInt(pathOrgMatch[1], 10);

  // Verify the authenticated user is a member of this org
  const membership = memberQueries.findMembership.get(
    organizationId,
    user.userId,
  );
  if (!membership) return c.json({ error: "Forbidden" }, 403);

  const absPath = resolveAttachmentPath(relPath, organizationId);
  if (!absPath) return c.json({ error: "Invalid path" }, 400);

  try {
    const filename = path.basename(absPath);
    const row = attachmentQueries.findByFilename.get(organizationId, filename);
    const mimeType = row?.mime_type || "application/octet-stream";

    const content = await fs.readFile(absPath);

    return new Response(content, {
      headers: {
        "Content-Type": mimeType,
        "Content-Disposition": `inline; filename="${filename}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return c.json({ error: "File not found" }, 404);
  }
});

// DELETE /api/attachments/delete?path=org-{id}/attachments/{filename}
attachmentsRouter.delete("/delete", async (c) => {
  const user = c.get("user");
  const organizationId = user.currentOrgId;
  if (!organizationId) return c.json({ error: "No organization context" }, 400);

  const relPath = c.req.query("path") || "";
  if (!relPath) return c.json({ error: "path is required" }, 400);

  const absPath = resolveAttachmentPath(relPath, organizationId);
  if (!absPath) return c.json({ error: "Invalid path" }, 400);

  try {
    await fs.unlink(absPath);
  } catch {
    // File may already be gone — continue to clean up DB record
  }

  const filename = path.basename(absPath);
  attachmentQueries.deleteByFilename.run(organizationId, filename);

  return c.json({ message: "Attachment deleted" });
});

export { attachmentsRouter };
