import type { Migration } from "../migrations";

export const addUserTheme: Migration = {
  id: 12,
  name: "add-user-theme",
  up: (db) => {
    db.exec(
      `ALTER TABLE users ADD COLUMN theme TEXT NOT NULL DEFAULT 'dark';`,
    );
    console.log("  ✅ Added theme column to users");
  },
  down: (db) => {
    db.exec(`ALTER TABLE users DROP COLUMN theme;`);
  },
};
