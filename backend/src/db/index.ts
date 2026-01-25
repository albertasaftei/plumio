import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = process.env.DB_PATH || "./data/pluma.db";

// Ensure the directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Initialize database
export const db = new Database(DB_PATH, { verbose: console.log });

// Enable WAL mode for better concurrency
db.pragma("journal_mode = WAL");

// Initialize schema
const schemaPath = path.join(__dirname, "schema.sql");
const schema = fs.readFileSync(schemaPath, "utf-8");

// Execute schema
db.exec(schema);

console.log("Database initialized at:", DB_PATH);

// Helper functions
export interface User {
  id: number;
  username: string;
  email: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  user_id: number;
  token: string;
  expires_at: string;
  created_at: string;
}

export interface Document {
  id: number;
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

// Session queries
export const sessionQueries = {
  create: db.prepare(
    "INSERT INTO sessions (id, user_id, token, expires_at) VALUES (?, ?, ?, ?)",
  ),
  findByToken: db.prepare("SELECT * FROM sessions WHERE token = ?"),
  deleteByToken: db.prepare("DELETE FROM sessions WHERE token = ?"),
  deleteExpired: db.prepare("DELETE FROM sessions WHERE expires_at < ?"),
  deleteByUserId: db.prepare("DELETE FROM sessions WHERE user_id = ?"),
};

// Document queries
export const documentQueries = {
  upsert: db.prepare(`
    INSERT INTO documents (user_id, path, title, color, size, updated_at)
    VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT(user_id, path) DO UPDATE SET
      title = excluded.title,
      color = excluded.color,
      size = excluded.size,
      updated_at = CURRENT_TIMESTAMP
  `),
  findByUserAndPath: db.prepare(
    "SELECT * FROM documents WHERE user_id = ? AND path = ?",
  ),
  listByUser: db.prepare(
    "SELECT * FROM documents WHERE user_id = ? ORDER BY updated_at DESC",
  ),
  updateColor: db.prepare(
    "UPDATE documents SET color = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND path = ?",
  ),
  delete: db.prepare("DELETE FROM documents WHERE user_id = ? AND path = ?"),
  deleteByPrefix: db.prepare(
    "DELETE FROM documents WHERE user_id = ? AND (path = ? OR path LIKE ?)",
  ),
  search: db.prepare(`
    SELECT d.* FROM documents d
    JOIN documents_fts fts ON d.id = fts.rowid
    WHERE d.user_id = ? AND documents_fts MATCH ?
    ORDER BY rank
  `),
  updateContent: db.prepare(`
    UPDATE documents_fts SET content = ?
    WHERE rowid = (SELECT id FROM documents WHERE user_id = ? AND path = ?)
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
