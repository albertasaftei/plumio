import type { Migration } from "../migrations";

export const addSettings: Migration = {
  id: 2,
  name: "add-settings",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log("Created 'settings' table");

    // Seed defaults (INSERT OR IGNORE so re-runs are safe)
    db.prepare("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)").run(
      "registration_enabled",
      "true",
    );
    console.log("Seeded default settings");

    console.log("Migration 002: Settings table configured");
  },
  down: (db) => {
    db.exec("DROP TABLE IF EXISTS settings;");
    console.log("Migration 002 rolled back: Settings table dropped");
  },
};
