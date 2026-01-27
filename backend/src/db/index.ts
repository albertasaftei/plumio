import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { runMigrations } from "./migrations.js";
import { allMigrations } from "./migrations/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || "./data/pluma.db";
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

// Helper functions
export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface Organization {
  id: number;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
}

export interface OrganizationMember {
  id: number;
  organization_id: number;
  user_id: number;
  role: string;
  joined_at: string;
}

export interface Session {
  id: string;
  user_id: number;
  token: string;
  current_organization_id: number | null;
  expires_at: string;
  created_at: string;
}

export interface Document {
  id: number;
  organization_id: number;
  user_id: number;
  path: string;
  title: string;
  color: string | null;
  size: number;
  created_at: string;
  updated_at: string;
}

// User queries
export const userQueries = {
  create: db.prepare(
    "INSERT INTO users (username, email, password_hash) VALUES (?, ?, ?)",
  ),
  findByUsername: db.prepare("SELECT * FROM users WHERE username = ?"),
  findByEmail: db.prepare("SELECT * FROM users WHERE email = ?"),
  findById: db.prepare("SELECT * FROM users WHERE id = ?"),
  listAll: db.prepare("SELECT * FROM users ORDER BY id ASC"),
  deleteById: db.prepare("DELETE FROM users WHERE id = ?"),
  updatePassword: db.prepare(
    "UPDATE users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ),
};

// Organization queries
export const organizationQueries = {
  create: db.prepare(
    "INSERT INTO organizations (name, slug, owner_id) VALUES (?, ?, ?)",
  ),
  findById: db.prepare("SELECT * FROM organizations WHERE id = ?"),
  findBySlug: db.prepare("SELECT * FROM organizations WHERE slug = ?"),
  listByUser: db.prepare(`
    SELECT o.* FROM organizations o
    JOIN organization_members om ON o.id = om.organization_id
    WHERE om.user_id = ?
    ORDER BY om.joined_at DESC
  `),
  update: db.prepare(
    "UPDATE organizations SET name = ?, slug = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
  ),
  delete: db.prepare("DELETE FROM organizations WHERE id = ?"),
};

// Organization member queries
export const memberQueries = {
  add: db.prepare(
    "INSERT INTO organization_members (organization_id, user_id, role) VALUES (?, ?, ?)",
  ),
  findMembership: db.prepare(
    "SELECT * FROM organization_members WHERE organization_id = ? AND user_id = ?",
  ),
  listByOrganization: db.prepare(`
    SELECT om.*, u.username, u.email FROM organization_members om
    JOIN users u ON om.user_id = u.id
    WHERE om.organization_id = ?
    ORDER BY om.role DESC, om.joined_at ASC
  `),
  updateRole: db.prepare(
    "UPDATE organization_members SET role = ? WHERE organization_id = ? AND user_id = ?",
  ),
  remove: db.prepare(
    "DELETE FROM organization_members WHERE organization_id = ? AND user_id = ?",
  ),
  isAdmin: db.prepare(
    "SELECT COUNT(*) as count FROM organization_members WHERE organization_id = ? AND user_id = ? AND role = 'admin'",
  ),
};

// Session queries
export const sessionQueries = {
  create: db.prepare(
    "INSERT INTO sessions (id, user_id, token, current_organization_id, expires_at) VALUES (?, ?, ?, ?, ?)",
  ),
  findByToken: db.prepare("SELECT * FROM sessions WHERE token = ?"),
  updateOrganization: db.prepare(
    "UPDATE sessions SET current_organization_id = ? WHERE token = ?",
  ),
  deleteByToken: db.prepare("DELETE FROM sessions WHERE token = ?"),
  deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at < ?"),
  deleteByUserId: db.prepare("DELETE FROM sessions WHERE user_id = ?"),
};

// Document queries
export const documentQueries = {
  upsert: db.prepare(`
    INSERT INTO documents (organization_id, user_id, path, title, color, size, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(organization_id, path) DO UPDATE SET
      title = excluded.title,
      color = excluded.color,
      size = excluded.size,
      updated_at = CURRENT_TIMESTAMP
  `),
  findByOrgAndPath: db.prepare(
    "SELECT * FROM documents WHERE organization_id = ? AND path = ?",
  ),
  listByOrganization: db.prepare(
    "SELECT * FROM documents WHERE organization_id = ? ORDER BY updated_at DESC",
  ),
  updateColor: db.prepare(
    "UPDATE documents SET color = ?, updated_at = CURRENT_TIMESTAMP WHERE organization_id = ? AND path = ?",
  ),
  delete: db.prepare(
    "DELETE FROM documents WHERE organization_id = ? AND path = ?",
  ),
  deleteByPrefix: db.prepare(
    "DELETE FROM documents WHERE organization_id = ? AND (path = ? OR path LIKE ?)",
  ),
  search: db.prepare(`
    SELECT d.* FROM documents d
    JOIN documents_fts fts ON d.id = fts.rowid
    WHERE d.organization_id = ? AND documents_fts MATCH ?
    ORDER BY rank
  `),
  updateContent: db.prepare(`
    DELETE FROM documents_fts 
    WHERE rowid = (SELECT id FROM documents WHERE organization_id = ? AND path = ?)
  `),
  insertContent: db.prepare(`
    INSERT INTO documents_fts(rowid, path, title, content)
    VALUES (
      (SELECT id FROM documents WHERE organization_id = ? AND path = ?),
      ?,
      (SELECT title FROM documents WHERE organization_id = ? AND path = ?),
      ?
    )
  `),
};

// Cleanup expired sessions periodically
setInterval(
  () => {
    const now = new Date().toISOString();
    sessionQueries.deleteExpired.run(now);
  },
  60 * 60 * 1000,
); // Every hour

export default db;
