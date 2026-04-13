import type { Migration } from "../migrations";

export const addTags: Migration = {
  id: 6,
  name: "add-tags",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        organization_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        color TEXT,
        description TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        UNIQUE(user_id, organization_id, name)
      );

      CREATE TABLE IF NOT EXISTS document_tags (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        document_id INTEGER NOT NULL,
        tag_id INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE,
        FOREIGN KEY (tag_id) REFERENCES tags(id) ON DELETE CASCADE,
        UNIQUE(document_id, tag_id)
      );

      CREATE INDEX IF NOT EXISTS idx_tags_user_org ON tags(user_id, organization_id);
      CREATE INDEX IF NOT EXISTS idx_document_tags_document ON document_tags(document_id);
      CREATE INDEX IF NOT EXISTS idx_document_tags_tag ON document_tags(tag_id);
    `);
    console.log("  ✅ Added tags and document_tags tables");
  },
  down: (db) => {
    db.exec(`
      DROP TABLE IF EXISTS document_tags;
      DROP TABLE IF EXISTS tags;
    `);
  },
};
