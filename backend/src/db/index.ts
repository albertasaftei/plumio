import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runMigrations } from "./migrations.js";
import { allMigrations } from "./migrations/index.js";
import {
  Document,
  Organization,
  OrganizationMember,
  Session,
  Tag,
  TagWithCount,
  User,
} from "./index.types.js";
import fsp from "fs/promises";
import pathMod from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || "./data/plumio.db";
const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || "./documents";

// Ensure directories exist
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}
if (!fs.existsSync(DOCUMENTS_PATH)) {
  fs.mkdirSync(DOCUMENTS_PATH, { recursive: true });
}

const isNewDatabase = !fs.existsSync(DB_PATH);

export const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

// Initialize database
if (isNewDatabase) {
  console.log("📦 Creating new database with schema...");
  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf-8");
  db.exec(schema);
  console.log("✅ Schema initialized");
}

// Run migrations on both new and existing databases
console.log("🔄 Checking for pending migrations...");
runMigrations(db, allMigrations);

// === User Queries ===
export const userQueries = {
  create: db.prepare<[string, string, string]>(
    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
  ),
  findByUsername: db.prepare<[string], User>(
    "SELECT * FROM users WHERE username = ?",
  ),
  findByEmail: db.prepare<[string], User>(
    "SELECT * FROM users WHERE email = ?",
  ),
  findById: db.prepare<[number], User>("SELECT * FROM users WHERE id = ?"),
  listAll: db.prepare<[], User>("SELECT * FROM users ORDER BY id ASC"),
  deleteById: db.prepare<[number]>("DELETE FROM users WHERE id = ?"),
  updatePassword: db.prepare<[string, number]>(
    "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ),
  setAdmin: db.prepare<[number, number]>(
    "UPDATE users SET is_admin = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ),
  updateUsername: db.prepare<[string, number]>(
    "UPDATE users SET username = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ),
  updateEmail: db.prepare<[string, number]>(
    "UPDATE users SET email = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ),
};

// === Organization Queries ===
export const organizationQueries = {
  create: db.prepare<[string, string, number]>(
    "INSERT INTO organizations (name, slug, owner_id) VALUES (?, ?, ?)",
  ),
  findById: db.prepare<[number], Organization>(
    "SELECT * FROM organizations WHERE id = ?",
  ),
  findBySlug: db.prepare<[string], Organization>(
    "SELECT * FROM organizations WHERE slug = ?",
  ),
  listByUser: db.prepare<[number], Organization>(`
    SELECT o.* FROM organizations o
    JOIN organization_members om ON o.id = om.organization_id
    WHERE om.user_id = ?
    ORDER BY om.joined_at DESC
  `),
  update: db.prepare<[string, string, number]>(
    "UPDATE organizations SET name = ?, slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ),
  delete: db.prepare<[number]>("DELETE FROM organizations WHERE id = ?"),
  listAll: db.prepare<[], Organization>(
    "SELECT * FROM organizations ORDER BY name ASC",
  ),
};

// === Organization Member Queries ===
export const memberQueries = {
  add: db.prepare<[number, number, string]>(
    "INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, ?)",
  ),
  findMembership: db.prepare<[number, number], OrganizationMember>(
    "SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ?",
  ),
  listByOrganization: db.prepare<[number], OrganizationMember>(`
    SELECT om.*, u.username, u.email FROM organization_members om
    JOIN users u ON om.user_id = u.id
    WHERE om.organization_id = ?
    ORDER BY om.role DESC, om.joined_at ASC
  `),
  updateRole: db.prepare<[string, number, number]>(
    "UPDATE organization_members SET role = ? WHERE organization_id = ? AND user_id = ?",
  ),
  remove: db.prepare<[number, number]>(
    "DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?",
  ),
  isAdmin: db.prepare<[number, number], { count: number }>(
    "SELECT COUNT(*) as count FROM organization_members WHERE organization_id = ? AND user_id = ? AND role = 'admin'",
  ),
  listByUser: db.prepare<
    [number],
    {
      id: number;
      name: string;
      slug: string;
      role: string;
      joined_at: string;
      owner_id: number;
    }
  >(`
    SELECT o.id, o.name, o.slug, o.owner_id, om.role, om.joined_at
    FROM organization_members om
    JOIN organizations o ON o.id = om.organization_id
    WHERE om.user_id = ?
    ORDER BY o.name ASC
  `),
};

// === Session Queries ===
export const sessionQueries = {
  create: db.prepare<[string, number, string, number | null, string]>(
    "INSERT INTO sessions (id, user_id, token, current_organization_id, expires_at) VALUES (?, ?, ?, ?, ?)",
  ),
  findByToken: db.prepare<[string], Session>(
    "SELECT * FROM sessions WHERE token = ?",
  ),
  updateOrganization: db.prepare<[number, string]>(
    "UPDATE sessions SET current_organization_id = ? WHERE token = ?",
  ),
  deleteByToken: db.prepare<[string]>("DELETE FROM sessions WHERE token = ?"),
  deleteExpired: db.prepare<[string]>(
    "DELETE FROM sessions WHERE expires_at < ?",
  ),
  deleteByUserId: db.prepare<[number]>(
    "DELETE FROM sessions WHERE user_id = ?",
  ),
};

// === Document Queries ===
export const documentQueries = {
  upsert: db.prepare<[number, number, string, string, string | null, number]>(`
    INSERT INTO documents (organization_id, user_id, path, title, color, size, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(organization_id, path) DO UPDATE SET
      title = excluded.title,
      color = excluded.color,
      size = excluded.size,
      updated_at = CURRENT_TIMESTAMP
  `),
  findByOrgAndPath: db.prepare<[number, string], Document>(
    "SELECT * FROM documents WHERE organization_id = ? AND path = ? AND archived = 0",
  ),
  findByOrgAndPathIncludingArchived: db.prepare<[number, string], Document>(
    "SELECT * FROM documents WHERE organization_id = ? AND path = ?",
  ),
  listByOrganization: db.prepare<[number], Document>(
    "SELECT * FROM documents WHERE organization_id = ? AND archived = 0 ORDER BY updated_at DESC",
  ),
  updateColor: db.prepare<[string | null, number, string]>(
    "UPDATE documents SET color = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND path = ?",
  ),
  delete: db.prepare<[number, string]>(
    "DELETE FROM documents WHERE organization_id = ? AND path = ?",
  ),
  deleteByPrefix: db.prepare<[number, string, string]>(
    "DELETE FROM documents WHERE organization_id = ? AND (path = ? OR path LIKE ?)",
  ),
  search: db.prepare<[number, string], Document>(`
    SELECT d.* FROM documents d
    JOIN documents_fts fts ON d.id = fts.rowid
    WHERE d.organization_id = ? AND d.archived = 0 AND documents_fts MATCH ?
    ORDER BY rank
  `),
  searchWithSnippets: db.prepare<
    [number, string],
    {
      path: string;
      title: string;
      color: string | null;
      updated_at: string;
      size: number;
      snippet: string;
    }
  >(`
    SELECT d.path, d.title, d.color, d.updated_at, d.size,
           snippet(documents_fts, 2, '<mark>', '</mark>', '...', 20) as snippet
    FROM documents_fts
    INNER JOIN documents d ON documents_fts.rowid = d.id
    WHERE d.organization_id = ? AND d.archived = 0 AND (d.deleted = 0 OR d.deleted IS NULL) AND documents_fts MATCH ?
    ORDER BY rank
  `),
  updateContent: db.prepare<[number, string]>(`
    DELETE FROM documents_fts 
    WHERE rowid = (SELECT id FROM documents WHERE organization_id = ? AND path = ?)
  `),
  insertContent: db.prepare<[number, string, string, number, string, string]>(`
    INSERT INTO documents_fts(rowid, path, title, content)
    VALUES (
      (SELECT id FROM documents WHERE organization_id = ? AND path = ?),
      ?,
      (SELECT title FROM documents WHERE organization_id = ? AND path = ?),
      ?
    )
  `),
  archiveDocument: db.prepare<[number, number, string]>(`
    UPDATE documents 
    SET archived = 1, archived_at = CURRENT_TIMESTAMP, archived_by = ?
    WHERE organization_id = ? AND path = ?
  `),
  unarchiveDocument: db.prepare<[number, string]>(`
    UPDATE documents 
    SET archived = 0, archived_at = NULL, archived_by = NULL
    WHERE organization_id = ? AND path = ?
  `),
  listArchivedDocuments: db.prepare<[number], Document>(`
    SELECT * FROM documents 
    WHERE organization_id = ? AND archived = 1
    ORDER BY archived_at DESC
  `),
  softDelete: db.prepare<[number, number, string]>(`
    UPDATE documents 
    SET deleted = 1, deleted_at = CURRENT_TIMESTAMP, deleted_by = ?
    WHERE organization_id = ? AND path = ?
  `),
  listDeletedDocuments: db.prepare<[number], Document>(`
    SELECT * FROM documents 
    WHERE organization_id = ? AND deleted = 1
    ORDER BY deleted_at DESC
  `),
  restoreDeleted: db.prepare<[number, string]>(`
    UPDATE documents 
    SET deleted = 0, deleted_at = NULL, deleted_by = NULL
    WHERE organization_id = ? AND path = ?
  `),
  findOldDeletedDocuments: db.prepare<[string], Document>(`
    SELECT * FROM documents 
    WHERE deleted = 1 AND deleted_at < ?
  `),
  permanentlyDelete: db.prepare<[number, string]>(
    "DELETE FROM documents WHERE organization_id = ? AND path = ?",
  ),
  updatePath: db.prepare<[string, number, string]>(
    "UPDATE documents SET path = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND path = ?",
  ),
  updatePathPrefix: (
    organizationId: number,
    oldPrefix: string,
    newPrefix: string,
  ) => {
    // Update the item itself and all descendants in a single statement
    return db
      .prepare(
        `UPDATE documents
         SET path = ? || substr(path, ?),
             updated_at = CURRENT_TIMESTAMP
         WHERE organization_id = ?
           AND (path = ? OR path LIKE ?)`,
      )
      .run(
        newPrefix,
        oldPrefix.length + 1,
        organizationId,
        oldPrefix,
        oldPrefix + "/%",
      );
  },
  permanentlyDeleteWithFtsCleanup: (
    organizationId: number,
    docPath: string,
  ) => {
    // Get the document ID first
    const doc = documentQueries.findByOrgAndPathIncludingArchived.get(
      organizationId,
      docPath,
    );

    if (!doc) {
      return { changes: 0 };
    }

    // Use a transaction: delete from FTS first, then from documents.
    // The documents_ad trigger would also fire on delete, but since we've
    // already removed the FTS row it becomes a no-op (rowid won't be found).
    // We intentionally do NOT drop/recreate the trigger — that pattern is
    // fragile and can permanently lose the trigger on any mid-transaction error.
    const transaction = db.transaction(() => {
      // Delete from FTS table first (ignore errors if row doesn't exist)
      try {
        db.prepare("DELETE FROM documents_fts WHERE rowid = ?").run(doc.id);
      } catch (e) {
        console.log("FTS cleanup warning:", e);
      }

      // Delete from documents table (trigger fires but FTS row is already gone)
      const result = db
        .prepare("DELETE FROM documents WHERE organization_id = ? AND path = ?")
        .run(organizationId, docPath);

      return result;
    });

    return transaction();
  },
  // Sort order queries for drag & drop reordering
  getSortOrder: db.prepare<[number, string], { sort_order: number }>(
    "SELECT sort_order FROM documents WHERE organization_id = ? AND path = ?",
  ),
  updateSortOrder: db.prepare<[number, number, string]>(
    "UPDATE documents SET sort_order = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND path = ?",
  ),
  ensureExists: db.prepare<[number, number, string, string, number]>(`
    INSERT INTO documents (organization_id, user_id, path, title, size)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(organization_id, path) DO NOTHING
  `),
  getSiblingsInFolder: db.prepare<
    [number, string, string],
    { path: string; sort_order: number }
  >(`
    SELECT path, sort_order FROM documents
    WHERE organization_id = ? AND archived = 0 AND (deleted = 0 OR deleted IS NULL)
      AND path LIKE ? AND path NOT LIKE ?
    ORDER BY sort_order ASC, path ASC
  `),
};

// === Attachment Queries ===
export interface Attachment {
  id: number;
  organization_id: number;
  document_path: string;
  filename: string;
  original_name: string;
  mime_type: string;
  size: number;
  uploaded_at: string;
  uploaded_by: number;
}

export const attachmentQueries = {
  insert: db.prepare<[number, string, string, string, string, number, number]>(`
    INSERT INTO attachments (organization_id, document_path, filename, original_name, mime_type, size, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `),
  listByDocument: db.prepare<[number, string], Attachment>(`
    SELECT * FROM attachments
    WHERE organization_id = ? AND document_path = ?
    ORDER BY uploaded_at DESC
  `),
  findByFilename: db.prepare<[number, string], Attachment>(`
    SELECT * FROM attachments
    WHERE organization_id = ? AND filename = ?
  `),
  deleteByFilename: db.prepare<[number, string]>(`
    DELETE FROM attachments WHERE organization_id = ? AND filename = ?
  `),
  deleteByDocumentPath: db.prepare<[number, string]>(`
    DELETE FROM attachments WHERE organization_id = ? AND document_path = ?
  `),
  listFilenamesByOrg: db.prepare<[number], { filename: string }>(`
    SELECT filename FROM attachments WHERE organization_id = ?
  `),
};

// === Settings Queries ===
export const settingsQueries = {
  get: db.prepare<[string], { key: string; value: string }>(
    "SELECT key, value FROM settings WHERE key = ?",
  ),
  set: db.prepare<[string, string]>(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
  ),
  getAll: db.prepare<[], { key: string; value: string }>(
    "SELECT key, value FROM settings ORDER BY key ASC",
  ),
};

// === Tag Queries ===
export const tagQueries = {
  create: db.prepare<[number, number, string, string | null, string | null]>(
    "INSERT INTO tags (user_id, organization_id, name, color, description) VALUES (?, ?, ?, ?, ?)",
  ),
  update: db.prepare<[string, string | null, string | null, number, number]>(
    "UPDATE tags SET name = ?, color = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?",
  ),
  delete: db.prepare<[number, number]>(
    "DELETE FROM tags WHERE id = ? AND user_id = ?",
  ),
  findById: db.prepare<[number, number], Tag>(
    "SELECT * FROM tags WHERE id = ? AND user_id = ?",
  ),
  findByName: db.prepare<[number, number, string], Tag>(
    "SELECT * FROM tags WHERE user_id = ? AND organization_id = ? AND name = ?",
  ),
  listByUserAndOrg: db.prepare<[number, number], TagWithCount>(`
    SELECT t.*, COALESCE(c.document_count, 0) as document_count
    FROM tags t
    LEFT JOIN (
      SELECT tag_id, COUNT(*) as document_count
      FROM document_tags
      GROUP BY tag_id
    ) c ON t.id = c.tag_id
    WHERE t.user_id = ? AND t.organization_id = ?
    ORDER BY t.name ASC
  `),
  addTagToDocument: db.prepare<[number, number]>(
    "INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)",
  ),
  removeTagFromDocument: db.prepare<[number, number]>(
    "DELETE FROM document_tags WHERE document_id = ? AND tag_id = ?",
  ),
  getTagsForDocument: db.prepare<
    [number, number],
    { id: number; name: string; color: string | null }
  >(`
    SELECT t.id, t.name, t.color
    FROM tags t
    JOIN document_tags dt ON t.id = dt.tag_id
    WHERE dt.document_id = ? AND t.user_id = ?
    ORDER BY t.name ASC
  `),
  getDocumentIdsForTag: db.prepare<[number], { document_id: number }>(
    "SELECT document_id FROM document_tags WHERE tag_id = ?",
  ),
  setDocumentTags: (documentId: number, tagIds: number[]) => {
    const transaction = db.transaction(() => {
      db.prepare("DELETE FROM document_tags WHERE document_id = ?").run(
        documentId,
      );
      const insert = db.prepare(
        "INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)",
      );
      for (const tagId of tagIds) {
        insert.run(documentId, tagId);
      }
    });
    transaction();
  },
  bulkAddTag: (documentIds: number[], tagId: number) => {
    const transaction = db.transaction(() => {
      const insert = db.prepare(
        "INSERT OR IGNORE INTO document_tags (document_id, tag_id) VALUES (?, ?)",
      );
      for (const docId of documentIds) {
        insert.run(docId, tagId);
      }
    });
    transaction();
  },
  bulkRemoveTag: (documentIds: number[], tagId: number) => {
    const transaction = db.transaction(() => {
      const del = db.prepare(
        "DELETE FROM document_tags WHERE document_id = ? AND tag_id = ?",
      );
      for (const docId of documentIds) {
        del.run(docId, tagId);
      }
    });
    transaction();
  },
  getAllDocumentTagMappings: db.prepare<
    [number, number],
    { document_id: number; tag_id: number }
  >(`
    SELECT dt.document_id, dt.tag_id
    FROM document_tags dt
    JOIN tags t ON dt.tag_id = t.id
    WHERE t.user_id = ? AND t.organization_id = ?
  `),
};

// === Password Reset Token Queries ===
export interface PasswordResetToken {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  used: number;
  created_at: string;
}

export const passwordResetQueries = {
  create: db.prepare<[number, string, string]>(
    "INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)",
  ),
  findByToken: db.prepare<[string], PasswordResetToken>(
    "SELECT * FROM password_reset_tokens WHERE token = ?",
  ),
  markUsed: db.prepare<[string]>(
    "UPDATE password_reset_tokens SET used = 1 WHERE token = ?",
  ),
  deleteByUserId: db.prepare<[number]>(
    "DELETE FROM password_reset_tokens WHERE user_id = ?",
  ),
  deleteExpired: db.prepare<[string]>(
    "DELETE FROM password_reset_tokens WHERE expires_at < ?",
  ),
};

// === Email Change Token Queries ===
export interface EmailChangeToken {
  id: number;
  user_id: number;
  new_email: string;
  token: string;
  expires_at: string;
  used: number;
  created_at: string;
}

export const emailChangeQueries = {
  create: db.prepare<[number, string, string, string]>(
    "INSERT INTO email_change_tokens (user_id, new_email, token, expires_at) VALUES (?, ?, ?, ?)",
  ),
  findByToken: db.prepare<[string], EmailChangeToken>(
    "SELECT * FROM email_change_tokens WHERE token = ?",
  ),
  markUsed: db.prepare<[string]>(
    "UPDATE email_change_tokens SET used = 1 WHERE token = ?",
  ),
  deleteByUserId: db.prepare<[number]>(
    "DELETE FROM email_change_tokens WHERE user_id = ?",
  ),
  deleteExpired: db.prepare<[string]>(
    "DELETE FROM email_change_tokens WHERE expires_at < ?",
  ),
};

// Cleanup expired sessions periodically (skip during tests)
if (process.env.NODE_ENV !== "test") {
  setInterval(
    () => {
      const now = new Date().toISOString();
      sessionQueries.deleteExpired.run(now);
      passwordResetQueries.deleteExpired.run(now);
      emailChangeQueries.deleteExpired.run(now);
    },
    60 * 60 * 1000,
  ); // Every hour
} // end test guard for session cleanup

// Cleanup old deleted documents (30+ days old) - runs daily (skip during tests)
if (process.env.NODE_ENV !== "test") {
  setInterval(
    async () => {
      try {
        // Calculate date 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const cutoffDate = thirtyDaysAgo.toISOString();

        // Find all documents deleted more than 30 days ago
        const oldDeleted =
          documentQueries.findOldDeletedDocuments.all(cutoffDate);

        console.log(
          `🧹 Cleanup job: Found ${oldDeleted.length} documents to permanently delete`,
        );

        // Import fs for file deletion
        const fs = await import("fs/promises");
        const path = await import("path");

        for (const doc of oldDeleted) {
          try {
            // Delete from database with FTS cleanup
            documentQueries.permanentlyDeleteWithFtsCleanup(
              doc.organization_id,
              doc.path,
            );

            // Delete physical file
            const DOCUMENTS_PATH = process.env.DOCUMENTS_PATH || "./documents";
            const orgPath = path.join(
              DOCUMENTS_PATH,
              `org-${doc.organization_id}`,
            );
            const filePath = path.join(orgPath, doc.path);

            try {
              await fs.unlink(filePath);
              console.log(`  ✅ Deleted: ${doc.path}`);
            } catch (err) {
              console.log(`  ⚠️  File already deleted: ${doc.path}`);
            }
          } catch (error) {
            console.error(`  ❌ Failed to delete ${doc.path}:`, error);
          }
        }

        if (oldDeleted.length > 0) {
          console.log(
            `✅ Cleanup job completed: ${oldDeleted.length} documents permanently deleted`,
          );
        }
      } catch (error) {
        console.error("❌ Cleanup job failed:", error);
      }
    },
    24 * 60 * 60 * 1000,
  ); // Every 24 hours

  // Reconcile DB records against physical files - runs daily
  async function reconcileDocuments() {
    try {
      let orgDirs: string[];
      try {
        const entries = await fsp.readdir(DOCUMENTS_PATH, {
          withFileTypes: true,
        });

        orgDirs = entries
          .filter((e) => e.isDirectory() && e.name.startsWith("org-"))
          .map((e) => e.name);
      } catch {
        return; // Documents directory doesn't exist yet
      }

      const findAnyRecord = db.prepare<[number, string], { id: number }>(
        "SELECT id FROM documents WHERE organization_id = ? AND path = ? LIMIT 1",
      );

      const activeRecords = db.prepare<[number], { id: number; path: string }>(
        "SELECT id, path FROM documents WHERE organization_id = ? AND (deleted = 0 OR deleted IS NULL) AND (archived = 0 OR archived IS NULL)",
      );

      let removedRecords = 0;
      let removedFiles = 0;
      let checked = 0;

      for (const orgDir of orgDirs) {
        const orgId = parseInt(orgDir.replace("org-", ""), 10);
        if (isNaN(orgId)) continue;

        const orgPath = pathMod.join(DOCUMENTS_PATH, orgDir);

        // 1. DB records with no physical file → purge the record
        const records = activeRecords.all(orgId);
        for (const record of records) {
          checked++;
          const filePath = pathMod.join(orgPath, record.path);
          try {
            await fsp.access(filePath);
          } catch {
            console.log(
              `  🗑️  Reconciliation: orphaned record removed [org-${orgId}] ${record.path}`,
            );
            documentQueries.permanentlyDeleteWithFtsCleanup(orgId, record.path);
            removedRecords++;
          }
        }

        // 2. Physical .md files with no DB record (any status) → delete the file
        let diskFiles: string[];
        try {
          diskFiles = await fsp.readdir(orgPath);
        } catch {
          continue;
        }

        for (const fileName of diskFiles) {
          // Only consider plain .md files; skip meta, deleted, archived variants
          if (!fileName.endsWith(".md")) continue;
          if (/\.(deleted|archived)-\d+\.md$/.test(fileName)) continue;

          // Normalize to the path stored in DB (leading slash)
          const docPath = `/${fileName}`;
          const existing = findAnyRecord.get(orgId, docPath);
          if (!existing) {
            const filePath = pathMod.join(orgPath, fileName);
            try {
              await fsp.unlink(filePath);
              console.log(
                `  🗑️  Reconciliation: untracked file deleted [org-${orgId}] ${fileName}`,
              );
              removedFiles++;
            } catch (err) {
              console.error(
                `  ❌  Reconciliation: failed to delete untracked file [org-${orgId}] ${fileName}:`,
                err,
              );
            }
          }
        }
      }

      const total = removedRecords + removedFiles;
      if (total > 0) {
        console.log(
          `✅ Reconciliation complete: checked ${checked} records, removed ${removedRecords} orphaned DB entries and ${removedFiles} untracked files`,
        );
      } else {
        console.log(
          `✅ Reconciliation complete: checked ${checked} records, no issues found`,
        );
      }
    } catch (error) {
      console.error("❌ Reconciliation job failed:", error);
    }
  }

  reconcileDocuments();
  setInterval(reconcileDocuments, 24 * 60 * 60 * 1000); // Every 24 hours
} // end test guard for cleanup/reconciliation

export default db;
