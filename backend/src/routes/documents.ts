import { Hono } from "hono";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ENCRYPTION_KEY } from "../config.js";
import { documentQueries } from "../db/index.js";
import { verifyToken } from "../middlewares/auth.js";
import { UserJWTPayload } from "../middlewares/auth.types.js";

type Variables = {
  user: UserJWTPayload;
};

const documentsRouter = new Hono<{ Variables: Variables }>();

const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || "./documents";
const encryptionKeyBuffer = Buffer.from(ENCRYPTION_KEY, "hex");

// Auth middleware
documentsRouter.use("*", async (c, next) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const token = authHeader.substring(7);
  const payload = await verifyToken(token);

  if (!payload) {
    return c.json({ error: "Invalid token" }, 401);
  }

  c.set("user", payload);
  await next();
});

// Get organization-specific documents path
function getOrgDocumentsPath(organizationId: number): string {
  return path.join(DOCUMENTS_PATH, `org-${organizationId}`);
}

// Encryption helpers
function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKeyBuffer, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text: string): string {
  const parts = text.split(":");
  const iv = Buffer.from(parts[0], "hex");
  const encryptedText = parts[1];
  const decipher = crypto.createDecipheriv(
    "aes-256-cbc",
    encryptionKeyBuffer,
    iv,
  );
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}

// Sanitize path to prevent directory traversal
function sanitizePath(userPath: string, organizationId: number): string {
  const normalized = path.normalize(userPath).replace(/^(\.\.[\/\\])+/, "");
  const orgPath = getOrgDocumentsPath(organizationId);
  return path.join(orgPath, normalized);
}

// List all documents and folders
documentsRouter.get("/list", async (c) => {
  const folderPath = c.req.query("path") || "/";
  const user = c.get("user");
  const organizationId = user.currentOrgId;

  if (!organizationId) {
    return c.json({ error: "No organization context" }, 400);
  }

  const fullPath = sanitizePath(folderPath, organizationId);

  try {
    await fs.access(fullPath);
    const items = await fs.readdir(fullPath, { withFileTypes: true });

    const result = await Promise.all(
      items
        .filter((item) => !item.name.endsWith(".meta.json")) // Filter out metadata files
        .map(async (item) => {
          const itemPath = path.join(fullPath, item.name);
          const stats = await fs.stat(itemPath);
          const orgPath = getOrgDocumentsPath(organizationId);
          const relativePath = path.relative(orgPath, itemPath);
          const docPath = "/" + relativePath.replace(/\\/g, "/");
          const metadataPath = itemPath + ".meta.json";

          // Check if document is archived in database
          const dbDoc = documentQueries.findByOrgAndPathIncludingArchived.get(
            organizationId,
            docPath,
          );

          // Skip archived documents
          if (dbDoc && dbDoc.archived === 1) {
            return null;
          }

          // Try to load metadata
          let metadata: any = {};
          try {
            const metaContent = await fs.readFile(metadataPath, "utf-8");
            metadata = JSON.parse(metaContent);
          } catch {
            // No metadata file, that's fine
          }

          return {
            name: item.name,
            path: docPath,
            type: item.isDirectory() ? "folder" : "file",
            modified: stats.mtime,
            size: stats.size,
            color: metadata.color || undefined,
          };
        }),
    );

    // Filter out null values (archived documents)
    const filteredResult = result.filter((item) => item !== null);

    return c.json({ items: filteredResult });
  } catch (error) {
    console.error("Error listing documents:", error);
    return c.json({ error: "Failed to list documents" }, 500);
  }
});

// Get document content
documentsRouter.get("/content", async (c) => {
  const filePath = c.req.query("path");
  const user = c.get("user");
  const organizationId = user.currentOrgId;

  if (!filePath) {
    return c.json({ error: "Path is required" }, 400);
  }

  if (!organizationId) {
    return c.json({ error: "No organization context" }, 400);
  }

  const fullPath = sanitizePath(filePath, organizationId);

  try {
    const encrypted = await fs.readFile(fullPath, "utf-8");

    // Try to decrypt, if it fails, return as plain text (backwards compatibility)
    let content: string;
    try {
      content = decrypt(encrypted);
    } catch {
      content = encrypted;
    }

    return c.json({ content, path: filePath });
  } catch (error) {
    console.error("Error reading document:", error);
    return c.json({ error: "Failed to read document" }, 500);
  }
});

// Save or create document
documentsRouter.post("/save", async (c) => {
  const { path: filePath, content } = await c.req.json();

  if (!filePath || content === undefined) {
    return c.json({ error: "Path and content are required" }, 400);
  }

  try {
    const user = c.get("user");
    const organizationId = user.currentOrgId;
    const userId = user.userId;

    if (!organizationId) {
      return c.json({ error: "No organization context" }, 400);
    }

    const fullPath = sanitizePath(filePath, organizationId);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Encrypt content
    const encrypted = encrypt(content);
    await fs.writeFile(fullPath, encrypted, "utf-8");

    // Get file stats
    const stats = await fs.stat(fullPath);

    // Extract title from content (first line without #)
    const title =
      content
        .split("\n")[0]
        .replace(/^#+\s*/, "")
        .trim() || path.basename(filePath, ".md");

    // Update document metadata and FTS index
    documentQueries.upsert.run(
      organizationId,
      userId,
      filePath,
      title,
      null,
      stats.size,
    );

    // Update FTS content (delete old entry and insert new one)
    try {
      documentQueries.updateContent.run(organizationId, filePath);
    } catch (e) {
      // Row might not exist in FTS yet, that's ok
    }
    documentQueries.insertContent.run(
      organizationId,
      filePath,
      filePath,
      organizationId,
      filePath,
      content,
    );

    return c.json({ message: "Document saved successfully", path: filePath });
  } catch (error) {
    console.error("Error saving document:", error);
    return c.json({ error: "Failed to save document" }, 500);
  }
});

// Create folder
documentsRouter.post("/folder", async (c) => {
  const { path: folderPath } = await c.req.json();
  const user = c.get("user");
  const organizationId = user.currentOrgId;

  if (!folderPath) {
    return c.json({ error: "Path is required" }, 400);
  }

  if (!organizationId) {
    return c.json({ error: "No organization context" }, 400);
  }

  const fullPath = sanitizePath(folderPath, organizationId);

  try {
    await fs.mkdir(fullPath, { recursive: true });
    return c.json({ message: "Folder created successfully", path: folderPath });
  } catch (error) {
    console.error("Error creating folder:", error);
    return c.json({ error: "Failed to create folder" }, 500);
  }
});

// Delete document or folder
documentsRouter.delete("/delete", async (c) => {
  const filePath = c.req.query("path");
  const user = c.get("user");
  const organizationId = user.currentOrgId;

  if (!filePath) {
    return c.json({ error: "Path is required" }, 400);
  }

  if (!organizationId) {
    return c.json({ error: "No organization context" }, 400);
  }

  const fullPath = sanitizePath(filePath, organizationId);

  try {
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true });
    } else {
      // Delete the document file
      await fs.unlink(fullPath);

      // Also delete the metadata file if it exists
      const metaPath = `${fullPath}.meta.json`;
      try {
        await fs.unlink(metaPath);
      } catch (metaError) {
        // Metadata file might not exist, which is fine
      }
    }

    return c.json({ message: "Deleted successfully" });
  } catch (error) {
    console.error("Error deleting:", error);
    return c.json({ error: "Failed to delete" }, 500);
  }
});

// Rename/move document or folder
documentsRouter.post("/rename", async (c) => {
  const { oldPath, newPath } = await c.req.json();
  const user = c.get("user");
  const organizationId = user.currentOrgId;

  if (!oldPath || !newPath) {
    return c.json({ error: "Both oldPath and newPath are required" }, 400);
  }

  if (!organizationId) {
    return c.json({ error: "No organization context" }, 400);
  }

  const fullOldPath = sanitizePath(oldPath, organizationId);
  const fullNewPath = sanitizePath(newPath, organizationId);

  try {
    // Ensure new directory exists
    await fs.mkdir(path.dirname(fullNewPath), { recursive: true });
    await fs.rename(fullOldPath, fullNewPath);

    return c.json({ message: "Renamed successfully", newPath });
  } catch (error) {
    console.error("Error renaming:", error);
    return c.json({ error: "Failed to rename" }, 500);
  }
});

// Set item color metadata
documentsRouter.post("/color", async (c) => {
  const { path: itemPath, color } = await c.req.json();
  const user = c.get("user");
  const organizationId = user.currentOrgId;

  if (!itemPath) {
    return c.json({ error: "Path is required" }, 400);
  }

  if (!organizationId) {
    return c.json({ error: "No organization context" }, 400);
  }

  const fullPath = sanitizePath(itemPath, organizationId);
  const metadataPath = fullPath + ".meta.json";

  try {
    // Verify the file/folder exists
    await fs.access(fullPath);

    // Read or create metadata
    let metadata: any = {};
    try {
      const metaContent = await fs.readFile(metadataPath, "utf-8");
      metadata = JSON.parse(metaContent);
    } catch {
      // Metadata file doesn't exist yet, that's fine
    }

    // Update color
    if (color) {
      metadata.color = color;
    } else {
      delete metadata.color;
    }

    // Save metadata
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    // Check if document exists in database, if not create it
    const existingDoc = documentQueries.findByOrgAndPath.get(
      organizationId,
      itemPath,
    );

    if (existingDoc) {
      // Update color in existing document
      documentQueries.updateColor.run(color, organizationId, itemPath);
    } else {
      // Document doesn't exist in DB yet, create it
      const stats = await fs.stat(fullPath);
      const fileName = path.basename(itemPath);
      const title = fileName.replace(/\.(md|txt)$/, "");

      documentQueries.upsert.run(
        organizationId,
        user.userId,
        itemPath,
        title,
        color,
        stats.size,
      );
    }

    return c.json({ message: "Color updated successfully" });
  } catch (error) {
    console.error("Error setting color:", error);
    return c.json({ error: "Failed to set color" }, 500);
  }
});

// Export all documents as encrypted zip
documentsRouter.post("/export", async (c) => {
  try {
    const user = c.get("user");
    const organizationId = user.currentOrgId;

    if (!organizationId) {
      return c.json({ error: "No organization context" }, 400);
    }

    const orgDocumentsPath = getOrgDocumentsPath(organizationId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const exportFile = path.join(
      "/tmp",
      `pluma-export-org${organizationId}-${timestamp}.tar.gz`,
    );

    // Create tar.gz of organization documents directory
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    await execAsync(
      `tar -czf ${exportFile} -C ${path.dirname(orgDocumentsPath)} ${path.basename(orgDocumentsPath)}`,
    );

    // Read the file
    const fileBuffer = await fs.readFile(exportFile);

    // Clean up temp file
    await fs.unlink(exportFile);

    // Return as download
    return c.body(fileBuffer, 200, {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="pluma-export-org${organizationId}-${timestamp}.tar.gz"`,
    });
  } catch (error) {
    console.error("Error exporting documents:", error);
    return c.json({ error: "Failed to export documents" }, 500);
  }
});

// Import documents from encrypted zip
documentsRouter.post("/import", async (c) => {
  try {
    const user = c.get("user");
    const organizationId = user.currentOrgId;

    if (!organizationId) {
      return c.json({ error: "No organization context" }, 400);
    }

    const body = await c.req.parseBody();
    const file = body["file"] as File;

    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }

    const orgDocumentsPath = getOrgDocumentsPath(organizationId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const tempFile = path.join("/tmp", `pluma-import-${timestamp}.tar.gz`);

    // Save uploaded file
    const buffer = await file.arrayBuffer();
    await fs.writeFile(tempFile, Buffer.from(buffer));

    // Extract to organization documents directory
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    // Extract archive - strip the top folder name (e.g., 'org-1')
    await execAsync(
      `tar -xzf ${tempFile} -C ${orgDocumentsPath} --strip-components=1`,
    );

    // Clean up temp file
    await fs.unlink(tempFile);

    return c.json({ message: "Documents imported successfully" });
  } catch (error) {
    console.error("Error importing documents:", error);
    return c.json({ error: "Failed to import documents" }, 500);
  }
});

// Search documents
documentsRouter.get("/search", async (c) => {
  const query = c.req.query("q");

  if (!query || query.trim().length === 0) {
    return c.json({ results: [] });
  }

  try {
    const user = c.get("user");
    const organizationId = user.currentOrgId;

    if (!organizationId) {
      return c.json({ error: "No organization context" }, 400);
    }

    // Search using SQLite FTS5
    const results = documentQueries.search.all(organizationId, query);

    // Return results with relevant info
    const searchResults = results.map((doc) => ({
      path: doc.path,
      title: doc.title,
      color: doc.color,
      modified: doc.updated_at,
      size: doc.size,
    }));

    return c.json({ results: searchResults });
  } catch (error) {
    console.error("Error searching documents:", error);
    return c.json({ error: "Search failed" }, 500);
  }
});

// Archive document
documentsRouter.post("/archive", async (c) => {
  const { path: docPath } = await c.req.json();
  const user = c.get("user");

  if (!user?.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  try {
    // Check if document exists in database
    const existing = documentQueries.findByOrgAndPath.get(
      user.currentOrgId,
      docPath,
    );

    if (!existing) {
      // Document not in database - need to add it first
      const fullPath = sanitizePath(docPath, user.currentOrgId);

      try {
        const stats = await fs.stat(fullPath);
        const fileName = path.basename(docPath, ".md");

        // Insert document into database first
        documentQueries.upsert.run(
          user.currentOrgId,
          user.userId,
          docPath,
          fileName,
          null, // no color
          stats.size,
        );
      } catch (err) {
        console.error("File not found:", docPath);
        return c.json({ error: "Document not found" }, 404);
      }
    }

    // Now archive it
    documentQueries.archiveDocument.run(
      user.userId,
      user.currentOrgId,
      docPath,
    );
    return c.json({ success: true });
  } catch (error) {
    console.error("Error archiving document:", error);
    return c.json({ error: "Failed to archive document" }, 500);
  }
});

// Unarchive document
documentsRouter.post("/unarchive", async (c) => {
  const { path: docPath } = await c.req.json();
  const user = c.get("user");

  if (!user?.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  try {
    documentQueries.unarchiveDocument.run(user.currentOrgId, docPath);
    return c.json({ success: true });
  } catch (error) {
    console.error("Error unarchiving document:", error);
    return c.json({ error: "Failed to unarchive document" }, 500);
  }
});

// List archived documents
documentsRouter.get("/archived", async (c) => {
  const user = c.get("user");

  if (!user?.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  try {
    const archived = documentQueries.listArchivedDocuments.all(
      user.currentOrgId,
    );

    const items = archived.map((doc) => ({
      path: doc.path,
      title: doc.title,
      type: doc.path.includes(".") ? "file" : "folder",
      color: doc.color,
      modified: doc.updated_at,
      size: doc.size,
      archived_at: doc.archived_at,
    }));

    return c.json({ items });
  } catch (error) {
    console.error("Error listing archived documents:", error);
    return c.json({ error: "Failed to list archived documents" }, 500);
  }
});

// Permanently delete archived document
documentsRouter.post("/archive/delete", async (c) => {
  const { path: docPath } = await c.req.json();
  const user = c.get("user");

  if (!user?.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  try {
    // Get organization documents path
    const orgPath = getOrgDocumentsPath(user.currentOrgId);

    // Delete physical file
    const filePath = path.join(orgPath, docPath);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // File might not exist, continue anyway
      console.log("File not found, continuing with DB delete:", filePath);
    }

    // Delete from database
    documentQueries.permanentlyDelete.run(user.currentOrgId, docPath);

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting archived document:", error);
    return c.json({ error: "Failed to delete document" }, 500);
  }
});

export { documentsRouter };
