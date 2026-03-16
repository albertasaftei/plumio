import type { Migration } from "../migrations";

export const addIsAdmin: Migration = {
  id: 3,
  name: "add-is-admin",
  up: (db) => {
    db.exec("ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0");
    console.log("Added 'is_admin' column to users table");

    // Preserve existing behaviour: first user is the admin
    db.prepare("UPDATE users SET is_admin = 1 WHERE id = 1").run();
    console.log("Set is_admin = 1 for first user");
  },
};
