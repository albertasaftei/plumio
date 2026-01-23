import { Hono } from "hono";
import fs from "fs/promises";
import path from "path";
import { verifyToken } from "./auth.js";
import crypto from "crypto";
import { ENCRYPTION_KEY } from "../config.js";

type Variables = {
  user: any;
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
function sanitizePath(userPath: string): string {
  const normalized = path.normalize(userPath).replace(/^(\.\.[\/\\])+/, "");
  return path.join(DOCUMENTS_PATH, normalized);
}

// List all documents and folders
documentsRouter.get("/list", async (c) => {
  const folderPath = c.req.query("path") || "/";
  const fullPath = sanitizePath(folderPath);

  try {
    await fs.access(fullPath);
    const items = await fs.readdir(fullPath, { withFileTypes: true });

    const result = await Promise.all(
      items
        .filter((item) => !item.name.endsWith(".meta.json")) // Filter out metadata files
        .map(async (item) => {
          const itemPath = path.join(fullPath, item.name);
          const stats = await fs.stat(itemPath);
          const relativePath = path.relative(DOCUMENTS_PATH, itemPath);
          const metadataPath = itemPath + ".meta.json";

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
            path: "/" + relativePath.replace(/\\/g, "/"),
            type: item.isDirectory() ? "folder" : "file",
            modified: stats.mtime,
            size: stats.size,
            color: metadata.color || undefined,
          };
        }),
    );

    return c.json({ items: result });
  } catch (error) {
    console.error("Error listing documents:", error);
    return c.json({ error: "Failed to list documents" }, 500);
  }
});

// Get document content
documentsRouter.get("/content", async (c) => {
  const filePath = c.req.query("path");

  if (!filePath) {
    return c.json({ error: "Path is required" }, 400);
  }

  const fullPath = sanitizePath(filePath);

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

  const fullPath = sanitizePath(filePath);

  try {
    // Ensure directory exists
    await fs.mkdir(path.dirname(fullPath), { recursive: true });

    // Encrypt content
    const encrypted = encrypt(content);
    await fs.writeFile(fullPath, encrypted, "utf-8");

    return c.json({ message: "Document saved successfully", path: filePath });
  } catch (error) {
    console.error("Error saving document:", error);
    return c.json({ error: "Failed to save document" }, 500);
  }
});

// Create folder
documentsRouter.post("/folder", async (c) => {
  const { path: folderPath } = await c.req.json();

  if (!folderPath) {
    return c.json({ error: "Path is required" }, 400);
  }

  const fullPath = sanitizePath(folderPath);

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

  if (!filePath) {
    return c.json({ error: "Path is required" }, 400);
  }

  const fullPath = sanitizePath(filePath);

  try {
    const stats = await fs.stat(fullPath);

    if (stats.isDirectory()) {
      await fs.rm(fullPath, { recursive: true });
    } else {
      await fs.unlink(fullPath);
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

  if (!oldPath || !newPath) {
    return c.json({ error: "Both oldPath and newPath are required" }, 400);
  }

  const fullOldPath = sanitizePath(oldPath);
  const fullNewPath = sanitizePath(newPath);

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

  if (!itemPath) {
    return c.json({ error: "Path is required" }, 400);
  }

  const fullPath = sanitizePath(itemPath);
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

    return c.json({ message: "Color updated successfully" });
  } catch (error) {
    console.error("Error setting color:", error);
    return c.json({ error: "Failed to set color" }, 500);
  }
});

export { documentsRouter };
