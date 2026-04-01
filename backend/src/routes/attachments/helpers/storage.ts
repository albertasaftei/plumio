import fs from "fs/promises";
import path from "path";
import { ALLOWED_ATTACHMENT_MIME_PREFIXES } from "../../../config.js";

export const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || "./documents";

export function getAttachmentsDir(organizationId: number): string {
  return path.join(DOCUMENTS_PATH, `org-${organizationId}`, "attachments");
}

export function isAllowedMime(mimeType: string): boolean {
  return ALLOWED_ATTACHMENT_MIME_PREFIXES.some((prefix) =>
    mimeType.startsWith(prefix),
  );
}

// Generate unique filename: "file.pdf" → "file (1).pdf" → "file (2).pdf" …
export async function getUniqueFilename(
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

// Validate that a requested file path belongs to the user's org and exists.
// Returns the absolute path, or null on failure.
export function resolveAttachmentPath(
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
