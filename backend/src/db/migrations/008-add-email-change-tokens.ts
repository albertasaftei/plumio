import type { Migration } from "../migrations";

export const addEmailChangeTokens: Migration = {
  id: 8,
  name: "add-email-change-tokens",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS email_change_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        new_email TEXT NOT NULL,
        token TEXT UNIQUE NOT NULL,
        expires_at TEXT NOT NULL,
        used INTEGER NOT NULL DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_email_change_tokens_token ON email_change_tokens(token);
      CREATE INDEX IF NOT EXISTS idx_email_change_tokens_user ON email_change_tokens(user_id);
    `);
    console.log("  ✅ Added email_change_tokens table");
  },
  down: (db) => {
    db.exec(`DROP TABLE IF EXISTS email_change_tokens;`);
  },
};
