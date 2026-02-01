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
  User,
} from "./index.types.js";

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
  updateColor: db.prepare<[string, number, string]>(
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

    // Use a transaction and disable triggers temporarily
    const transaction = db.transaction(() => {
      // Delete from FTS table first (ignore errors if it doesn't exist)
      try {
        db.prepare("DELETE FROM documents_fts WHERE rowid = ?").run(doc.id);
      } catch (e) {
        console.log("FTS cleanup warning:", e);
      }

      // Drop the trigger temporarily
      try {
        db.prepare("DROP TRIGGER IF EXISTS documents_ad").run();
      } catch (e) {
        console.log("Trigger drop warning:", e);
      }

      // Delete from documents table
      const result = db
        .prepare("DELETE FROM documents WHERE organization_id = ? AND path = ?")
        .run(organizationId, docPath);

      // Recreate the trigger
      try {
        db.prepare(
          `
          CREATE TRIGGER documents_ad AFTER DELETE ON documents BEGIN
            DELETE FROM documents_fts WHERE rowid = old.id;
          END;
        `,
        ).run();
      } catch (e) {
        console.log("Trigger recreate warning:", e);
      }

      return result;
    });

    return transaction();
  },
};

// Cleanup expired sessions periodically
setInterval(
  () => {
    const now = new Date().toISOString();
    sessionQueries.deleteExpired.run(now);
  },
  60 * 60 * 1000,
); // Every hour

// Cleanup old deleted documents (30+ days old) - runs daily
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

export default db;
