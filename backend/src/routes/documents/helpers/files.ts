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
        item.isFile() &&
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
