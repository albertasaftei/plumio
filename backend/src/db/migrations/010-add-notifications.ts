import type { Migration } from "../migrations";

export const addNotifications: Migration = {
  id: 10,
  name: "add-notifications",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT,
        metadata TEXT,
        read INTEGER NOT NULL DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, read);
      CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at);
    `);
    console.log("  ✅ Added notifications table");
  },
  down: (db) => {
    db.exec(`DROP TABLE IF EXISTS notifications;`);
  },
};
