import type { Migration } from "../migrations";

export const addAttachments: Migration = {
  id: 4,
  name: "add-attachments",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS attachments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        document_path TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        size INTEGER NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        uploaded_by INTEGER NOT NULL,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaded_by) REFERENCES users(id)
      );

      CREATE INDEX IF NOT EXISTS idx_attachments_org_doc
        ON attachments(organization_id, document_path);
    `);
    console.log("  ✅ Created attachments table");
  },
  down: (db) => {
    db.exec(`DROP TABLE IF EXISTS attachments;`);
  },
};
