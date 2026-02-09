import { Hono } from "hono";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { ENCRYPTION_KEY, ENABLE_ENCRYPTION } from "../config.js";
import db, { documentQueries } from "../db/index.js";
import { authMiddleware } from "../middlewares/auth.js";
import { UserJWTPayload } from "../middlewares/auth.types.js";
import * as z from "zod";
import { DocumentMetadata } from "../db/index.types.js";

type Variables = {
  user: UserJWTPayload;
};

const documentsRouter = new Hono<{ Variables: Variables }>();

const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || "./documents";
const encryptionKeyBuffer = ENABLE_ENCRYPTION
  ? Buffer.from(ENCRYPTION_KEY, "hex")
  : Buffer.alloc(0);

// Auth middleware
documentsRouter.use("*", authMiddleware);

// Get organization-specific documents path
function getOrgDocumentsPath(organizationId: number): string {
  return path.join(DOCUMENTS_PATH, `org-${organizationId}`);
}

// Encryption helpers
function encrypt(text: string): string {
  if (!ENABLE_ENCRYPTION) {
    return text;
  }
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKeyBuffer, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

function decrypt(text: string): string {
  if (!ENABLE_ENCRYPTION) {
    return text;
  }
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

// Generate unique file path by appending (1), (2), etc. if file already exists
async function getUniqueFilePath(
  basePath: string,
  organizationId: number,
  isNewDocument: boolean = false,
): Promise<string> {
  // If not a new document, return the path as-is
  if (!isNewDocument) {
    return basePath;
  }

  const orgPath = getOrgDocumentsPath(organizationId);
  const fullPath = path.join(orgPath, basePath);

  // Check if file exists
  try {
    await fs.access(fullPath);
    // File exists, need to generate unique name
  } catch {
    // File doesn't exist, can use the original path
    return basePath;
  }

  // Parse the path to extract directory, filename, and extension
  const dir = path.dirname(basePath);
  const filename = path.basename(basePath);
  const ext = path.extname(filename);
  const nameWithoutExt = filename.slice(0, -ext.length);

  // Try with incrementing counter until we find a unique name
  let counter = 1;
  while (true) {
    const newName = `${nameWithoutExt} (${counter})${ext}`;
    const newPath = dir === "/" ? `/${newName}` : `${dir}/${newName}`;
    const newFullPath = path.join(orgPath, newPath);

    try {
      await fs.access(newFullPath);
      // File exists, try next counter
      counter++;
    } catch {
      // File doesn't exist, we can use this path
      return newPath;
    }
  }
}

async function ensureOrgDirectoryExists(organizationId: number): Promise<void> {
  const orgPath = getOrgDocumentsPath(organizationId);
  try {
    await fs.access(orgPath);
  } catch {
    // Directory doesn't exist, create it
    await fs.mkdir(orgPath, { recursive: true });
  }
}

// Allowed file extensions for import
const ALLOWED_EXTENSIONS = [".md"];
const ALLOWED_METADATA_EXTENSIONS = [".meta.json"];

// Check if a file has an allowed extension
function hasAllowedExtension(fileName: string): boolean {
  // Check for metadata files first (ends with .meta.json)
  if (ALLOWED_METADATA_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
    return true;
  }

  // Check for regular file extensions
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

// Recursively remove hidden files, folders, and files with invalid extensions
async function cleanupInvalidFiles(dirPath: string): Promise<void> {
  try {
    const items = await fs.readdir(dirPath, { withFileTypes: true });

    for (const item of items) {
      const itemPath = path.join(dirPath, item.name);

      // Check if item is hidden (starts with .)
      if (item.name.startsWith(".")) {
        // Remove hidden file or directory
        if (item.isDirectory()) {
          await fs.rm(itemPath, { recursive: true, force: true });
        } else {
          await fs.unlink(itemPath);
        }
        console.log(`Removed hidden item: ${item.name}`);
      } else if (item.isDirectory()) {
        // Recursively clean subdirectories first
        await cleanupInvalidFiles(itemPath);

        // After cleaning, check if directory is now empty and remove it
        try {
          const remainingItems = await fs.readdir(itemPath);
          if (remainingItems.length === 0) {
            await fs.rmdir(itemPath);
            console.log(`Removed empty directory: ${item.name}`);
          }
        } catch (err) {
          // Directory might not exist or other error, continue
        }
      } else {
        if (!hasAllowedExtension(item.name)) {
          await fs.unlink(itemPath);
          console.log(`Removed file with invalid extension: ${item.name}`);
        }
      }
    }
  } catch (error) {
    console.error("Error cleaning invalid files:", error);
    // Don't throw - allow import to continue even if cleanup fails
  }
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
    await ensureOrgDirectoryExists(organizationId);

    const orgPath = getOrgDocumentsPath(organizationId);

    await fs.access(fullPath);
    const items = await fs.readdir(fullPath, { withFileTypes: true });

    const result = await Promise.all(
      items
        .filter((item) => !item.name.startsWith(".")) // Filter out hidden files/folders
        .filter((item) => !item.name.endsWith(".meta.json")) // Filter out metadata files
        .filter((item) => !item.name.includes(".archived-")) // Filter out archived files
        .filter((item) => !item.name.includes(".deleted-")) // Filter out deleted files
        .filter((item) => item.isDirectory() || hasAllowedExtension(item.name)) // Only show folders or allowed file types
        .map(async (item) => {
          const itemPath = path.join(fullPath, item.name);
          const stats = await fs.stat(itemPath);
          const orgPath = getOrgDocumentsPath(organizationId);
          const relativePath = path.relative(orgPath, itemPath);
          const docPath = "/" + relativePath.replace(/\\/g, "/");
          const metadataPath = itemPath + ".meta.json";

          // Check if document is archived or deleted in database
          const dbDoc = documentQueries.findByOrgAndPathIncludingArchived.get(
            organizationId,
            docPath,
          );

          // Skip archived or deleted documents
          if (dbDoc && (dbDoc.archived === 1 || dbDoc.deleted === 1)) {
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
            modified: stats.mtime.toISOString(),
            size: stats.size,
            color: metadata.color || undefined,
            favorite: metadata.favorite || false,
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
    const fileContent = await fs.readFile(fullPath, "utf-8");

    // Try to decrypt if encryption is enabled, if it fails, return as plain text (backwards compatibility)
    let content: string;
    if (ENABLE_ENCRYPTION) {
      try {
        content = decrypt(fileContent);
      } catch {
        // Failed to decrypt, might be a plain text file
        content = fileContent;
      }
    } else {
      content = fileContent;
    }

    return c.json({ content, path: filePath });
  } catch (error) {
    console.error("Error reading document:", error);
    return c.json({ error: "Failed to read document" }, 500);
  }
});

const saveDocumentSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  isNew: z.boolean().optional(),
});

// Save or create document
documentsRouter.post("/save", async (c) => {
  const parsed = saveDocumentSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const { path: filePath, content, isNew = false } = parsed.data;

  if (!filePath || !content) {
    return c.json({ error: "Path and content are required" }, 400);
  }
  try {
    const user = c.get("user");
    const organizationId = user.currentOrgId;
    const userId = user.userId;

    if (!organizationId) {
      return c.json({ error: "No organization context" }, 400);
    }

    // Get unique file path if this is a new document
    const uniquePath = await getUniqueFilePath(filePath, organizationId, isNew);
    const fullPath = sanitizePath(uniquePath, organizationId);

    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Encrypt content if encryption is enabled
    const fileContent = encrypt(content);
    await fs.writeFile(fullPath, fileContent, "utf-8");

    // Get file stats
    const stats = await fs.stat(fullPath);

    // Extract title from content (first line without #)
    const title =
      content
        .split("\n")[0]
        .replace(/^#+\s*/, "")
        .trim() || path.basename(uniquePath, ".md");

    // Update document metadata and FTS index
    documentQueries.upsert.run(
      organizationId,
      userId,
      uniquePath,
      title,
      null,
      stats.size,
    );

    // Update FTS content (delete old entry and insert new one)
    try {
      documentQueries.updateContent.run(organizationId, uniquePath);
    } catch (e) {
      // Row might not exist in FTS yet, that's ok
    }
    documentQueries.insertContent.run(
      organizationId,
      uniquePath,
      uniquePath,
      organizationId,
      uniquePath,
      content,
    );

    return c.json({ message: "Document saved successfully", path: uniquePath });
  } catch (error) {
    console.error("Error saving document:", error);
    return c.json({ error: "Failed to save document" }, 500);
  }
});

const createFolderSchema = z.object({
  path: z.string().min(1),
});

// Create folder
documentsRouter.post("/folder", async (c) => {
  const parsed = createFolderSchema.safeParse(await c.req.json());
  const user = c.get("user");
  const organizationId = user.currentOrgId;

  if (!parsed.success) {
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  if (!organizationId) {
    return c.json({ error: "No organization context" }, 400);
  }

  const { path: folderPath } = parsed.data;

  const fullPath = sanitizePath(folderPath, organizationId);

  try {
    await fs.mkdir(fullPath, { recursive: true });
    return c.json({ message: "Folder created successfully", path: folderPath });
  } catch (error) {
    console.error("Error creating folder:", error);
    return c.json({ error: "Failed to create folder" }, 500);
  }
});

const deleteDocumentSchema = z.object({
  path: z.string().min(1),
});

// Delete document or folder (soft delete - moves to deleted folder)
documentsRouter.delete("/delete", async (c) => {
  const parsed = deleteDocumentSchema.safeParse({ path: c.req.query("path") });
  const user = c.get("user");
  const organizationId = user.currentOrgId;

  if (!parsed.success) {
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  if (!organizationId) {
    return c.json({ error: "No organization context" }, 400);
  }

  const { path: filePath } = parsed.data;
  const fullPath = sanitizePath(filePath, organizationId);

  try {
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      // For folders, still do immediate deletion (or we could recursively soft delete all files)
      await fs.rm(fullPath, { recursive: true });
    } else {
      // Soft delete: rename file with .deleted-{timestamp} suffix
      const timestamp = Date.now();
      const pathParts = filePath.split("/");
      const fileName = pathParts.pop() || "";
      const fileNameWithoutExt = fileName.replace(/\.md$/, "");
      const deletedFileName = `${fileNameWithoutExt}.deleted-${timestamp}.md`;
      const deletedPath = [...pathParts, deletedFileName].join("/");

      // Rename the physical file
      const newFullPath = sanitizePath(deletedPath, organizationId);
      try {
        await fs.rename(fullPath, newFullPath);
      } catch (err) {
        console.error("Error renaming file:", err);
      }

      // Check if document exists in database
      const existing = documentQueries.findByOrgAndPathIncludingArchived.get(
        organizationId,
        filePath,
      );

      if (existing) {
        // Update database: mark as deleted and update path
        db.prepare(
          `
          UPDATE documents 
          SET path = ?, deleted = 1, deleted_at = CURRENT_TIMESTAMP, deleted_by = ?
          WHERE organization_id = ? AND path = ?
        `,
        ).run(deletedPath, user.userId, organizationId, filePath);
      } else {
        // Document not in DB, add it as deleted
        const title = fileName.replace(/\.md$/, "");
        documentQueries.upsert.run(
          organizationId,
          user.userId,
          deletedPath,
          title,
          null,
          stats.size,
        );
        documentQueries.softDelete.run(
          user.userId,
          organizationId,
          deletedPath,
        );
      }

      // Delete the metadata file if it exists
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

const renameDocumentSchema = z.object({
  oldPath: z.string().min(1),
  newPath: z.string().min(1),
});
// Rename/move document or folder
documentsRouter.post("/rename", async (c) => {
  const parsed = renameDocumentSchema.safeParse(await c.req.json());
  const user = c.get("user");
  const organizationId = user.currentOrgId;

  if (!parsed.success) {
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  if (!organizationId) {
    return c.json({ error: "No organization context" }, 400);
  }

  const { oldPath, newPath } = parsed.data;
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

const colorDocumentSchema = z.object({
  path: z.string().min(1),
  color: z.string(),
});

const favoriteDocumentSchema = z.object({
  path: z.string().min(1),
  favorite: z.boolean(),
});

// Toggle item favorite metadata
documentsRouter.post("/favorite", async (c) => {
  const parsed = favoriteDocumentSchema.safeParse(await c.req.json());
  const user = c.get("user");
  const organizationId = user.currentOrgId;

  if (!parsed.success) {
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  if (!organizationId) {
    return c.json({ error: "No organization context" }, 400);
  }

  const { path: itemPath, favorite } = parsed.data;
  const fullPath = sanitizePath(itemPath, organizationId);
  const metadataPath = fullPath + ".meta.json";

  try {
    // Verify the file/folder exists
    await fs.access(fullPath);

    // Read or create metadata
    let metadata: DocumentMetadata = {};
    try {
      const metaContent = await fs.readFile(metadataPath, "utf-8");
      metadata = JSON.parse(metaContent);
    } catch {
      // Metadata file doesn't exist yet, that's fine
    }

    // Update favorite
    if (favorite) {
      metadata.favorite = true;
    } else {
      delete metadata.favorite;
    }

    // Save metadata
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

    return c.json({ message: "Favorite updated successfully" });
  } catch (error) {
    console.error("Error setting favorite:", error);
    return c.json({ error: "Failed to set favorite" }, 500);
  }
});

// Set item color metadata
documentsRouter.post("/color", async (c) => {
  const parsed = colorDocumentSchema.safeParse(await c.req.json());
  const user = c.get("user");
  const organizationId = user.currentOrgId;

  if (!parsed.success) {
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  if (!organizationId) {
    return c.json({ error: "No organization context" }, 400);
  }

  const { path: itemPath, color } = parsed.data;
  const fullPath = sanitizePath(itemPath, organizationId);
  const metadataPath = fullPath + ".meta.json";

  try {
    // Verify the file/folder exists
    await fs.access(fullPath);

    // Read or create metadata
    let metadata: DocumentMetadata = {};
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
      `plumio-export-org${organizationId}-${timestamp}.tar.gz`,
    );

    // Create tar.gz of organization documents directory
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    // Ensure the directory exists
    await ensureOrgDirectoryExists(organizationId);

    // Create tar.gz from inside the org directory (no wrapper folder)
    const tarCommand = `tar -czf "${exportFile}" -C "${orgDocumentsPath}" .`;

    try {
      await execAsync(tarCommand);

      // Verify the archive was created and has content
      const stats = await fs.stat(exportFile);

      if (stats.size === 0) {
        throw new Error("Export archive is empty");
      }

      console.log(`Export created: ${exportFile} (${stats.size} bytes)`);
    } catch (tarError: any) {
      console.error("Export failed:", tarError);
      throw new Error(`Export failed: ${tarError.message}`);
    }

    // Read the file
    const fileBuffer = await fs.readFile(exportFile);

    // Clean up temp file
    await fs.unlink(exportFile);

    // Return as download
    return c.body(fileBuffer, 200, {
      "Content-Type": "application/gzip",
      "Content-Disposition": `attachment; filename="plumio-export-org${organizationId}-${timestamp}.tar.gz"`,
    });
  } catch (error) {
    console.error("Error exporting documents:", error);
    return c.json({ error: "Failed to export documents" }, 500);
  }
});

const importDocumentSchema = z.object({
  file: z.instanceof(File),
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
    const parsed = importDocumentSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({ error: z.treeifyError(parsed.error) }, 400);
    }

    const orgDocumentsPath = getOrgDocumentsPath(organizationId);
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const tempFile = path.join("/tmp", `plumio-import-${timestamp}.tar.gz`);

    // Save uploaded file
    const file = parsed.data.file;
    const buffer = await file.arrayBuffer();
    await fs.writeFile(tempFile, Buffer.from(buffer));

    // Extract to organization documents directory
    const { exec } = await import("child_process");
    const { promisify } = await import("util");
    const execAsync = promisify(exec);

    // Extract archive directly to organization documents path
    // This works for both plumio exports and third-party app exports (like Obsidian)
    await execAsync(
      `tar -xzf ${tempFile} -C ${orgDocumentsPath} --exclude='.*' --exclude='*/.*'`,
    );

    // Clean up temp file
    await fs.unlink(tempFile);

    // Additional cleanup: Remove any hidden files and files with invalid extensions
    await cleanupInvalidFiles(orgDocumentsPath);

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

const archiveDocumentSchema = z.object({
  path: z.string().min(1),
});
// Archive document
documentsRouter.post("/archive", async (c) => {
  const parsed = archiveDocumentSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const { path: docPath } = parsed.data;
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

    // Now archive it - rename path with timestamp
    const timestamp = Date.now();
    const pathParts = docPath.split("/");
    const fileName = pathParts.pop() || "";
    const fileNameWithoutExt = fileName.replace(/\.md$/, "");
    const archivedFileName = `${fileNameWithoutExt}.archived-${timestamp}.md`;
    const archivedPath = [...pathParts, archivedFileName].join("/");

    // Rename the physical file
    const orgPath = getOrgDocumentsPath(user.currentOrgId);
    const oldFilePath = path.join(orgPath, docPath);
    const newFilePath = path.join(orgPath, archivedPath);

    try {
      await fs.rename(oldFilePath, newFilePath);
    } catch (err) {
      console.error("Error renaming file:", err);
      // Continue anyway - file might not exist on disk
    }

    // Update database - change path and set archived flag
    db.prepare(
      `
      UPDATE documents 
      SET path = ?, archived = 1, archived_at = CURRENT_TIMESTAMP, archived_by = ?
      WHERE organization_id = ? AND path = ?
    `,
    ).run(archivedPath, user.userId, user.currentOrgId, docPath);

    return c.json({ success: true, archivedPath });
  } catch (error) {
    console.error("Error archiving document:", error);
    return c.json({ error: "Failed to archive document" }, 500);
  }
});

const unarchiveDocumentSchema = z.object({
  path: z.string().min(1),
});
// Unarchive document
documentsRouter.post("/unarchive", async (c) => {
  const parsed = unarchiveDocumentSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const { path: docPath } = parsed.data;
  const user = c.get("user");

  if (!user?.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  try {
    // Extract original path by removing the .archived-{timestamp} suffix
    const restoredPath = docPath.replace(/\.archived-\d+\.md$/, ".md");

    // Check if a file with the restored name already exists
    const existing = documentQueries.findByOrgAndPath.get(
      user.currentOrgId,
      restoredPath,
    );

    if (existing) {
      return c.json(
        {
          error:
            "A file with this name already exists. Please delete or rename it first.",
        },
        409,
      );
    }

    // Rename the physical file back
    const orgPath = getOrgDocumentsPath(user.currentOrgId);
    const archivedFilePath = path.join(orgPath, docPath);
    const restoredFilePath = path.join(orgPath, restoredPath);

    try {
      await fs.rename(archivedFilePath, restoredFilePath);
    } catch (err) {
      console.error("Error renaming file:", err);
      // Continue anyway - file might not exist on disk
    }

    // Update database - restore original path and unarchive
    db.prepare(
      `
      UPDATE documents 
      SET path = ?, archived = 0, archived_at = NULL, archived_by = NULL
      WHERE organization_id = ? AND path = ?
    `,
    ).run(restoredPath, user.currentOrgId, docPath);

    return c.json({ success: true, restoredPath });
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

const deleteArchivedDocumentSchema = z.object({
  path: z.string().min(1),
});

// Permanently delete archived document
documentsRouter.post("/archive/delete", async (c) => {
  const parsed = deleteArchivedDocumentSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const { path: docPath } = parsed.data;

  const user = c.get("user");

  if (!user?.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  try {
    // Delete from database first
    const result = documentQueries.permanentlyDeleteWithFtsCleanup(
      user.currentOrgId,
      docPath,
    );

    if (result.changes === 0) {
      return c.json({ error: "Document not found in database" }, 404);
    }

    // Try to delete physical file (ignore if it doesn't exist)
    const orgPath = getOrgDocumentsPath(user.currentOrgId);
    const filePath = path.join(orgPath, docPath);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // File doesn't exist or already deleted, which is fine
      console.log("File not found on filesystem (already deleted):", filePath);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error deleting archived document:", error);
    return c.json({ error: "Failed to delete document" }, 500);
  }
});

// List recently deleted documents
documentsRouter.get("/deleted", async (c) => {
  const user = c.get("user");

  if (!user?.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  try {
    const deleted = documentQueries.listDeletedDocuments.all(user.currentOrgId);

    const items = deleted.map((doc) => ({
      path: doc.path,
      title: doc.title,
      type: doc.path.includes(".") ? "file" : "folder",
      color: doc.color,
      modified: doc.updated_at,
      size: doc.size,
      deleted_at: doc.deleted_at,
    }));

    return c.json({ items });
  } catch (error) {
    console.error("Error listing deleted documents:", error);
    return c.json({ error: "Failed to list deleted documents" }, 500);
  }
});

const restoreDocumentSchema = z.object({
  path: z.string().min(1),
});

// Restore recently deleted document
documentsRouter.post("/deleted/restore", async (c) => {
  const parsed = restoreDocumentSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  }

  const { path: docPath } = parsed.data;
  const user = c.get("user");

  if (!user?.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  try {
    // Extract original path by removing the .deleted-{timestamp} suffix
    const restoredPath = docPath.replace(/\.deleted-\d+\.md$/, ".md");

    // Check if a file with the restored name already exists
    const existing = documentQueries.findByOrgAndPath.get(
      user.currentOrgId,
      restoredPath,
    );

    if (existing) {
      return c.json(
        {
          error:
            "A file with this name already exists. Please delete or rename it first.",
        },
        409,
      );
    }

    // Rename the physical file back
    const orgPath = getOrgDocumentsPath(user.currentOrgId);
    const deletedFilePath = path.join(orgPath, docPath);
    const restoredFilePath = path.join(orgPath, restoredPath);

    try {
      await fs.rename(deletedFilePath, restoredFilePath);
    } catch (err) {
      console.error("Error renaming file:", err);
      // Continue anyway - file might not exist on disk
    }

    // Update database - restore original path and mark as not deleted
    db.prepare(
      `
      UPDATE documents 
      SET path = ?, deleted = 0, deleted_at = NULL, deleted_by = NULL
      WHERE organization_id = ? AND path = ?
    `,
    ).run(restoredPath, user.currentOrgId, docPath);

    return c.json({ success: true, restoredPath });
  } catch (error) {
    console.error("Error restoring document:", error);
    return c.json({ error: "Failed to restore document" }, 500);
  }
});

const permanentlyDeleteDocumentSchema = z.object({
  path: z.string().min(1),
});

// Permanently delete recently deleted document
documentsRouter.post("/deleted/permanent", async (c) => {
  const parsed = permanentlyDeleteDocumentSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: z.treeifyError(parsed.error) }, 400);
  }
  const { path: docPath } = parsed.data;
  const user = c.get("user");

  if (!user?.currentOrgId) {
    return c.json({ error: "No organization selected" }, 400);
  }

  try {
    // Delete from database first
    const result = documentQueries.permanentlyDeleteWithFtsCleanup(
      user.currentOrgId,
      docPath,
    );

    if (result.changes === 0) {
      return c.json({ error: "Document not found in database" }, 404);
    }

    // Try to delete physical file (ignore if it doesn't exist)
    const orgPath = getOrgDocumentsPath(user.currentOrgId);
    const filePath = path.join(orgPath, docPath);
    try {
      await fs.unlink(filePath);
    } catch (err) {
      // File doesn't exist or already deleted, which is fine
      console.log("File not found on filesystem (already deleted):", filePath);
    }

    return c.json({ success: true });
  } catch (error) {
    console.error("Error permanently deleting document:", error);
    return c.json({ error: "Failed to delete document" }, 500);
  }
});

export { documentsRouter };
