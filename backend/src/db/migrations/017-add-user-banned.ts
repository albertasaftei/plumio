import type { Migration } from "../migrations";

export const addUserBanned: Migration = {
  id: 17,
  name: "add-user-banned",
  up: (db) => {
    db.exec(
      "ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0",
    );
    console.log("Added 'is_banned' column to users table");
  },
};
