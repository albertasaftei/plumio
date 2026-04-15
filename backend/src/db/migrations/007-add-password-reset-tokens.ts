import type { Migration } from "../migrations";

export const addPasswordResetTokens: Migration = {
  id: 7,
  name: "add-password-reset-tokens",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS password_reset_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token ON password_reset_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user ON password_reset_tokens(user_id);
    `);
    console.log("  ✅ Added password_reset_tokens table");
  },
  down: (db) => {
    db.exec(`DROP TABLE IF EXISTS password_reset_tokens;`);
  },
};
