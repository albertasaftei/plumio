import type { Migration } from "../migrations";

export const addSync: Migration = {
  id: 15,
  name: "add-sync",
  up: (db) => {
    db.exec(`
      CREATE TABLE IF NOT EXISTS sync_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id INTEGER NOT NULL UNIQUE,
        provider TEXT NOT NULL CHECK(provider IN ('s3', 's3-compatible', 'dropbox', 'gdrive', 'onedrive')),
        credentials_encrypted TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        schedule TEXT NOT NULL DEFAULT 'manual',
        remote_prefix TEXT NOT NULL DEFAULT '',
        last_sync_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS sync_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        org_id INTEGER NOT NULL,
        provider TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('running', 'success', 'error')),
        files_uploaded INTEGER NOT NULL DEFAULT 0,
        files_deleted INTEGER NOT NULL DEFAULT 0,
        error_message TEXT,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        completed_at DATETIME,
        FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sync_configs_org_id ON sync_configs(org_id);
      CREATE INDEX IF NOT EXISTS idx_sync_log_org_id ON sync_log(org_id);
      CREATE INDEX IF NOT EXISTS idx_sync_log_started_at ON sync_log(started_at DESC);
    `);
    console.log("  ✅ Added sync_configs and sync_log tables");
  },
};
