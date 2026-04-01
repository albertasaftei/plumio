import fs from "fs/promises";
import path from "path";
import { attachmentQueries } from "../../../db/index.js";
import { DOCUMENTS_PATH } from "./paths.js";

// Allowed file extensions for import
export const ALLOWED_EXTENSIONS = [".md"];
export const ALLOWED_METADATA_EXTENSIONS = [".meta.json"];

// Check if a file has an allowed extension
export function hasAllowedExtension(fileName: string): boolean {
  // Check for metadata files first (ends with .meta.json)
  if (ALLOWED_METADATA_EXTENSIONS.some((ext) => fileName.endsWith(ext))) {
    return true;
  }

  // Check for regular file extensions
  const ext = path.extname(fileName).toLowerCase();
  return ALLOWED_EXTENSIONS.includes(ext);
}

// Recursively collect all active .md files under a directory (ignores archived/deleted/hidden)
export async function collectMdFilesRecursively(
  dir: string,
): Promise<string[]> {
  const files: string[] = [];
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    for (const item of items) {
      if (item.name.startsWith(".") || item.name.endsWith(".meta.json"))
        continue;
      const fullItemPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files.push(...(await collectMdFilesRecursively(fullItemPath)));
      } else if (
        item.name.endsWith(".md") &&
        !item.name.includes(".archived-") &&
        !item.name.includes(".deleted-")
      ) {
        files.push(fullItemPath);
      }
    }
  } catch {
    // ignore read errors
  }
  return files;
}

// Recursively remove hidden files, folders, and files with invalid extensions
export async function cleanupInvalidFiles(dirPath: string): Promise<void> {
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
        // Never touch the attachments directory created by the attachments feature
        if (item.name === "attachments") continue;

        // Recursively clean subdirectories first
        await cleanupInvalidFiles(itemPath);

        // After cleaning, check if directory is now empty and remove it
        try {
          const remainingItems = await fs.readdir(itemPath);
          if (remainingItems.length === 0) {
            await fs.rmdir(itemPath);
            console.log(`Removed empty directory: ${item.name}`);
          }
        } catch {
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

// Delete all attachment files and DB records for a given document path
export async function deleteDocumentAttachments(
  organizationId: number,
  documentPath: string,
): Promise<void> {
  const attachmentsDir = path.join(
    DOCUMENTS_PATH,
    `org-${organizationId}`,
    "attachments",
  );
  const rows = attachmentQueries.listByDocument.all(
    organizationId,
    documentPath,
  );
  for (const row of rows) {
    try {
      await fs.unlink(path.join(attachmentsDir, row.filename));
    } catch {
      // File already gone — still remove DB record
    }
  }
  attachmentQueries.deleteByDocumentPath.run(organizationId, documentPath);
}
