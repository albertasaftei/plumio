/**
 * Document Lifecycle Module
 *
 * Deep module that owns all document state transitions: soft-delete, rename,
 * move, archive, restore, and permanent deletion. Coordinates filesystem
 * operations with database state atomically and delivers webhooks.
 *
 * Interface is intentionally narrow: callers pass org/user context and paths.
 * Implementation absorbs FS I/O, DB queries, metadata sidecar handling,
 * path normalization, and webhook delivery.
 */

import fs from "fs/promises";
import path from "path";
import db, { documentQueries } from "../db/index.js";
import { deliverWebhook } from "../utils/webhooks.js";
import {
  getOrgDocumentsPath,
  sanitizePath,
} from "../routes/documents/helpers/paths.js";
import { collectMdFilesRecursively } from "../routes/documents/helpers/files.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface LifecycleContext {
  organizationId: number;
  userId: number;
}

export interface SoftDeleteResult {
  deletedPath: string;
}

export interface RenameResult {
  newPath: string;
}

export interface MoveResult {
  newPath: string;
}

export interface ArchiveResult {
  archivedPath: string;
}

export interface RestoreResult {
  restoredPath: string;
}

// ─── Soft Delete ─────────────────────────────────────────────────────────────

/**
 * Soft-deletes a file: renames with `.deleted-{timestamp}` suffix on disk,
 * marks as deleted in DB, and renames the metadata sidecar.
 */
export async function softDeleteFile(
  ctx: LifecycleContext,
  filePath: string,
): Promise<SoftDeleteResult> {
  const { organizationId, userId } = ctx;
  const fullPath = sanitizePath(filePath, organizationId);

  const timestamp = Date.now();
  const pathParts = filePath.split("/");
  const fileName = pathParts.pop() || "";
  const fileNameWithoutExt = fileName.replace(/\.md$/, "");
  const deletedFileName = `${fileNameWithoutExt}.deleted-${timestamp}.md`;
  const deletedPath = [...pathParts, deletedFileName].join("/");

  const newFullPath = sanitizePath(deletedPath, organizationId);

  // Rename on disk
  try {
    await fs.rename(fullPath, newFullPath);
  } catch (err) {
    console.error("Error renaming file for soft-delete:", err);
  }

  // Update or create DB record
  const existing = documentQueries.findByOrgAndPathIncludingArchived.get(
    organizationId,
    filePath,
  );

  if (existing) {
    db.prepare(
      `UPDATE documents
       SET path = ?, deleted = 1, deleted_at = CURRENT_TIMESTAMP, deleted_by = ?
       WHERE organization_id = ? AND path = ?`,
    ).run(deletedPath, userId, organizationId, filePath);
  } else {
    const stats = await fs.stat(newFullPath).catch(() => ({ size: 0 }));
    const title = fileName.replace(/\.md$/, "");
    documentQueries.upsert.run(
      organizationId,
      userId,
      deletedPath,
      title,
      null,
      stats.size,
    );
    documentQueries.softDelete.run(userId, organizationId, deletedPath);
  }

  // Rename metadata sidecar
  try {
    await fs.rename(`${fullPath}.meta.json`, `${newFullPath}.meta.json`);
  } catch {
    // Metadata file might not exist
  }

  deliverWebhook(organizationId, "document.deleted", { path: filePath });
  return { deletedPath };
}

/**
 * Soft-deletes a folder: renames each .md file inside with `.deleted-{timestamp}`
 * suffix, marks each in DB, then removes the now-empty folder.
 */
export async function softDeleteFolder(
  ctx: LifecycleContext,
  folderPath: string,
): Promise<void> {
  const { organizationId, userId } = ctx;
  const fullPath = sanitizePath(folderPath, organizationId);
  const orgPath = getOrgDocumentsPath(organizationId);
  const timestamp = Date.now();

  const mdFiles = await collectMdFilesRecursively(fullPath);

  for (const absFilePath of mdFiles) {
    const relFilePath = path.relative(orgPath, absFilePath).replace(/\\/g, "/");
    const parts = relFilePath.split("/");
    const fileName = parts.pop() || "";
    const baseName = fileName.replace(/\.md$/, "");
    const deletedFileName = `${baseName}.deleted-${timestamp}.md`;
    const deletedRelPath = [...parts, deletedFileName].join("/");
    const absDeletedPath = path.join(orgPath, deletedRelPath);

    try {
      await fs.rename(absFilePath, absDeletedPath);
    } catch {
      // file may not be on disk
    }

    const existing = documentQueries.findByOrgAndPathIncludingArchived.get(
      organizationId,
      relFilePath,
    );
    if (existing) {
      db.prepare(
        `UPDATE documents
         SET path = ?, deleted = 1, deleted_at = CURRENT_TIMESTAMP, deleted_by = ?
         WHERE organization_id = ? AND path = ?`,
      ).run(deletedRelPath, userId, organizationId, relFilePath);
    } else {
      const fileStats = await fs
        .stat(absDeletedPath)
        .catch(() => ({ size: 0 }));
      documentQueries.upsert.run(
        organizationId,
        userId,
        deletedRelPath,
        baseName,
        null,
        fileStats.size,
      );
      documentQueries.softDelete.run(userId, organizationId, deletedRelPath);
    }
  }

  // Remove the now-empty folder
  await fs.rm(fullPath, { recursive: true });
  deliverWebhook(organizationId, "folder.deleted", { path: folderPath });
}

// ─── Rename ──────────────────────────────────────────────────────────────────

/**
 * Renames a document or folder on disk and updates all DB path references.
 * For folders, updates all descendant paths via prefix replacement.
 */
export async function rename(
  ctx: LifecycleContext,
  oldPath: string,
  newPath: string,
): Promise<RenameResult> {
  const { organizationId } = ctx;
  const fullOldPath = sanitizePath(oldPath, organizationId);
  const fullNewPath = sanitizePath(newPath, organizationId);

  // Ensure destination directory exists
  await fs.mkdir(path.dirname(fullNewPath), { recursive: true });

  // Conflict check
  if (fullOldPath !== fullNewPath) {
    try {
      await fs.access(fullNewPath);
      throw new ConflictError("An item with this name already exists");
    } catch (err) {
      if (err instanceof ConflictError) throw err;
      // Destination doesn't exist — safe to proceed
    }
  }

  // Rename on disk
  await fs.rename(fullOldPath, fullNewPath);

  // Move metadata sidecar
  try {
    await fs.access(fullOldPath + ".meta.json");
    await fs.rename(fullOldPath + ".meta.json", fullNewPath + ".meta.json");
  } catch {
    // No metadata file
  }

  // Update DB paths
  const stats = await fs.stat(fullNewPath);
  if (stats.isDirectory()) {
    documentQueries.updatePathPrefix(organizationId, oldPath, newPath);
  } else {
    documentQueries.updatePath.run(newPath, organizationId, oldPath);
  }

  deliverWebhook(organizationId, "document.renamed", { oldPath, newPath });
  return { newPath };
}

// ─── Move ────────────────────────────────────────────────────────────────────

/**
 * Moves a document or folder to a different parent directory within the
 * same organization. Handles disk move, metadata sidecar, and DB path updates.
 */
export async function move(
  ctx: LifecycleContext,
  sourcePath: string,
  destinationFolder: string,
): Promise<MoveResult> {
  const { organizationId } = ctx;

  // Prevent moving into self or descendant
  if (
    destinationFolder === sourcePath ||
    destinationFolder.startsWith(sourcePath + "/")
  ) {
    throw new ValidationError(
      "Cannot move an item into itself or its own descendant",
    );
  }

  const fullSourcePath = sanitizePath(sourcePath, organizationId);
  const itemName = path.basename(sourcePath);
  const newPath =
    destinationFolder === "/"
      ? `/${itemName}`
      : `${destinationFolder}/${itemName}`;

  // No-op if already in target
  if (newPath === sourcePath) {
    return { newPath };
  }

  const fullNewPath = sanitizePath(newPath, organizationId);

  // Check source exists
  await fs.access(fullSourcePath);

  // Conflict check
  try {
    await fs.access(fullNewPath);
    throw new ConflictError(
      "An item with the same name already exists at the destination",
    );
  } catch (err) {
    if (err instanceof ConflictError) throw err;
    // Good — target doesn't exist yet
  }

  // Ensure destination directory exists
  await fs.mkdir(path.dirname(fullNewPath), { recursive: true });

  // Move on disk
  await fs.rename(fullSourcePath, fullNewPath);

  // Move metadata sidecar
  try {
    await fs.access(fullSourcePath + ".meta.json");
    await fs.rename(fullSourcePath + ".meta.json", fullNewPath + ".meta.json");
  } catch {
    // No metadata file
  }

  // Update DB paths
  const stats = await fs.stat(fullNewPath);
  if (stats.isDirectory()) {
    documentQueries.updatePathPrefix(organizationId, sourcePath, newPath);
  } else {
    documentQueries.updatePath.run(newPath, organizationId, sourcePath);
  }

  deliverWebhook(organizationId, "document.renamed", {
    oldPath: sourcePath,
    newPath,
  });
  return { newPath };
}

// ─── Archive ─────────────────────────────────────────────────────────────────

/**
 * Archives a document: renames with `.archived-{timestamp}` suffix on disk
 * and marks as archived in DB.
 */
export async function archive(
  ctx: LifecycleContext,
  docPath: string,
): Promise<ArchiveResult> {
  const { organizationId, userId } = ctx;

  // Ensure document exists in DB (create record if needed)
  const existing = documentQueries.findByOrgAndPath.get(
    organizationId,
    docPath,
  );
  if (!existing) {
    const fullPath = sanitizePath(docPath, organizationId);
    const stats = await fs.stat(fullPath);
    const fileName = path.basename(docPath, ".md");
    documentQueries.upsert.run(
      organizationId,
      userId,
      docPath,
      fileName,
      null,
      stats.size,
    );
  }

  // Build archived path
  const timestamp = Date.now();
  const pathParts = docPath.split("/");
  const fileName = pathParts.pop() || "";
  const fileNameWithoutExt = fileName.replace(/\.md$/, "");
  const archivedFileName = `${fileNameWithoutExt}.archived-${timestamp}.md`;
  const archivedPath = [...pathParts, archivedFileName].join("/");

  // Rename on disk
  const orgPath = getOrgDocumentsPath(organizationId);
  const oldFilePath = path.join(orgPath, docPath);
  const newFilePath = path.join(orgPath, archivedPath);

  try {
    await fs.rename(oldFilePath, newFilePath);
  } catch (err) {
    console.error("Error renaming file for archive:", err);
    // Continue — file might not exist on disk
  }

  // Update DB
  db.prepare(
    `UPDATE documents
     SET path = ?, archived = 1, archived_at = CURRENT_TIMESTAMP, archived_by = ?
     WHERE organization_id = ? AND path = ?`,
  ).run(archivedPath, userId, organizationId, docPath);

  deliverWebhook(organizationId, "document.archived", {
    path: docPath,
    archivedPath,
  });
  return { archivedPath };
}

/**
 * Unarchives a document: restores the original filename and clears the
 * archived flag in DB.
 */
export async function unarchive(
  ctx: LifecycleContext,
  docPath: string,
): Promise<RestoreResult> {
  const { organizationId } = ctx;

  const restoredPath = docPath.replace(/\.archived-\d+\.md$/, ".md");

  // Conflict check
  const existing = documentQueries.findByOrgAndPath.get(
    organizationId,
    restoredPath,
  );
  if (existing) {
    throw new ConflictError(
      "A file with this name already exists. Please delete or rename it first.",
    );
  }

  // Rename on disk
  const orgPath = getOrgDocumentsPath(organizationId);
  const archivedFilePath = path.join(orgPath, docPath);
  const restoredFilePath = path.join(orgPath, restoredPath);

  try {
    await fs.rename(archivedFilePath, restoredFilePath);
  } catch (err) {
    console.error("Error renaming file for unarchive:", err);
    // Continue — file might not exist on disk
  }

  // Update DB
  db.prepare(
    `UPDATE documents
     SET path = ?, archived = 0, archived_at = NULL, archived_by = NULL
     WHERE organization_id = ? AND path = ?`,
  ).run(restoredPath, organizationId, docPath);

  deliverWebhook(organizationId, "document.unarchived", {
    path: restoredPath,
  });
  return { restoredPath };
}

// ─── Restore from Trash ──────────────────────────────────────────────────────

/**
 * Restores a soft-deleted document: renames back to original path on disk
 * and clears the deleted flag in DB.
 */
export async function restoreDeleted(
  ctx: LifecycleContext,
  docPath: string,
): Promise<RestoreResult> {
  const { organizationId } = ctx;

  const restoredPath = docPath.replace(/\.deleted-\d+\.md$/, ".md");

  // Conflict check
  const existing = documentQueries.findByOrgAndPath.get(
    organizationId,
    restoredPath,
  );
  if (existing) {
    throw new ConflictError(
      "A file with this name already exists. Please delete or rename it first.",
    );
  }

  // Rename on disk
  const orgPath = getOrgDocumentsPath(organizationId);
  const deletedFilePath = path.join(orgPath, docPath);
  const restoredFilePath = path.join(orgPath, restoredPath);

  // Ensure parent directory exists (may have been deleted with the folder)
  await fs.mkdir(path.dirname(restoredFilePath), { recursive: true });

  try {
    await fs.rename(deletedFilePath, restoredFilePath);
  } catch (err) {
    console.error("Error renaming file for restore:", err);
    // File is gone — restore as empty document
    try {
      await fs.writeFile(restoredFilePath, "", "utf-8");
    } catch (writeErr) {
      console.error("Error creating empty restored file:", writeErr);
    }
  }

  // Restore metadata sidecar
  const deletedMetaPath = path.join(orgPath, `${docPath}.meta.json`);
  const restoredMetaPath = path.join(orgPath, `${restoredPath}.meta.json`);
  try {
    await fs.rename(deletedMetaPath, restoredMetaPath);
  } catch {
    // Metadata file might not exist
  }

  // Update DB
  db.prepare(
    `UPDATE documents
     SET path = ?, deleted = 0, deleted_at = NULL, deleted_by = NULL
     WHERE organization_id = ? AND path = ?`,
  ).run(restoredPath, organizationId, docPath);

  deliverWebhook(organizationId, "document.restored", { path: restoredPath });
  return { restoredPath };
}

// ─── Permanent Deletion ──────────────────────────────────────────────────────

/**
 * Permanently deletes a document: removes from DB (with FTS cleanup),
 * removes from disk, and deletes associated attachments.
 */
export async function permanentlyDelete(
  ctx: LifecycleContext,
  docPath: string,
): Promise<void> {
  const { organizationId } = ctx;

  const result = documentQueries.permanentlyDeleteWithFtsCleanup(
    organizationId,
    docPath,
  );

  if (result.changes === 0) {
    throw new NotFoundError("Document not found in database");
  }

  // Delete physical file
  const orgPath = getOrgDocumentsPath(organizationId);
  const filePath = path.join(orgPath, docPath);
  try {
    await fs.unlink(filePath);
  } catch {
    // File doesn't exist or already deleted
  }

  // Delete attachments
  const { deleteDocumentAttachments } =
    await import("../routes/documents/helpers/files.js");
  await deleteDocumentAttachments(organizationId, docPath);
}

// ─── Error Types ─────────────────────────────────────────────────────────────

export class ConflictError extends Error {
  readonly code = "CONFLICT" as const;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

export class ValidationError extends Error {
  readonly code = "VALIDATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NotFoundError extends Error {
  readonly code = "NOT_FOUND" as const;
  constructor(message: string) {
    super(message);
    this.name = "NotFoundError";
  }
}
