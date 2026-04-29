import type { Migration } from "../migrations";

export const addJoinRequests: Migration = {
  id: 9,
  name: "add-join-requests",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS join_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        organization_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending',
        message TEXT,
        reviewed_by INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
      );

      CREATE INDEX IF NOT EXISTS idx_join_requests_org_status ON join_requests(organization_id, status);
      CREATE INDEX IF NOT EXISTS idx_join_requests_user_status ON join_requests(user_id, status);
    `);
    console.log("  ✅ Added join_requests table");
  },
  down: (db) => {
    db.exec(`DROP TABLE IF EXISTS join_requests;`);
  },
};
