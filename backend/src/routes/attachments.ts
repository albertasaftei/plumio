import { Hono } from "hono";
import fs from "fs/promises";
import path from "path";
import { verifyToken } from "../middlewares/auth.js";
import { attachmentQueries } from "../db/index.js";
import { UserJWTPayload } from "../middlewares/auth.types.js";
import {
  MAX_ATTACHMENT_SIZE_MB,
  ALLOWED_ATTACHMENT_MIME_PREFIXES,
} from "../config.js";

type Variables = {
  user: UserJWTPayload;
};

const attachmentsRouter = new Hono<{ Variables: Variables }>();

const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || "./documents";

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

function getAttachmentsDir(organizationId: number): string {
  return path.join(DOCUMENTS_PATH, `org-${organizationId}`, "attachments");
}

function isAllowedMime(mimeType: string): boolean {
  return ALLOWED_ATTACHMENT_MIME_PREFIXES.some((prefix) =>
    mimeType.startsWith(prefix),
  );
}

// Generate unique filename: "file.pdf" → "file (1).pdf" → "file (2).pdf" …
async function getUniqueFilename(
  dir: string,
  originalName: string,
): Promise<string> {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);

  let candidate = originalName;
  let counter = 1;
  while (true) {
    try {
      await fs.access(path.join(dir, candidate));
      // File exists — try next counter
      candidate = `${base} (${counter})${ext}`;
      counter++;
    } catch {
      // File does not exist — candidate is free
      return candidate;
    }
  }
}

// Validate that a requested file path belongs to the user's org and exists
// Returns the absolute path, or null on failure
function resolveAttachmentPath(
  relPath: string,
  organizationId: number,
): string | null {
  // relPath is expected as "org-{id}/attachments/{filename}"
  const expected = `org-${organizationId}/attachments/`;
  if (!relPath.startsWith(expected)) return null;

  const filename = path.basename(relPath);
  // Reject traversal characters
  if (filename.includes("..") || filename.includes("/")) return null;

  return path.join(
    DOCUMENTS_PATH,
    `org-${organizationId}`,
    "attachments",
    filename,
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

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
  const organizationId = user.currentOrgId;
  if (!organizationId) return c.json({ error: "No organization context" }, 400);

  const relPath = c.req.query("path") || "";
  if (!relPath) return c.json({ error: "path is required" }, 400);

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
