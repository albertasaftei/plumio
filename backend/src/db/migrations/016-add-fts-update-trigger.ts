import type { Migration } from "../migrations";

export const addFtsUpdateTrigger: Migration = {
  id: 16,
  name: "add-fts-update-trigger",
  up: (db) => {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS documents_au AFTER UPDATE OF path, title ON documents BEGIN
          UPDATE documents_fts SET path = new.path, title = new.title
          WHERE rowid = new.id;
      END;
    `);
  },
};
