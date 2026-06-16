import type { Migration } from "../migrations";

export const addOrgMemberBanned: Migration = {
  id: 18,
  name: "add-org-member-banned",
  up: (db) => {
    db.exec(
      "ALTER TABLE organization_members ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0",
    );
    console.log("Added 'is_banned' column to organization_members table");
  },
};
