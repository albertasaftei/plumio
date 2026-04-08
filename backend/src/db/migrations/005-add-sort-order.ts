import type { Migration } from "../migrations";

export const addSortOrder: Migration = {
  id: 5,
  name: "add-sort-order",
  up: (db) => {
    db.exec(`
      ALTER TABLE documents ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
    `);
    console.log("  ✅ Added sort_order column to documents table");
  },
  down: (db) => {
    // SQLite doesn't support DROP COLUMN in older versions,
    // but better-sqlite3 uses a recent enough SQLite version
    db.exec(`ALTER TABLE documents DROP COLUMN sort_order;`);
  },
};
