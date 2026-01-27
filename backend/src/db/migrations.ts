import Database from "better-sqlite3";

export interface Migration {
  id: number;
  name: string;
  up: (db: Database.Database) => void;
  down?: (db: Database.Database) => void;
}

// Migrations table to track which migrations have been applied
export function initMigrationsTable(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
}

export function getAppliedMigrations(db: Database.Database): number[] {
  const rows = db.prepare("SELECT id FROM migrations ORDER BY id").all() as {
    id: number;
  }[];
  return rows.map((r) => r.id);
}

export function applyMigration(db: Database.Database, migration: Migration) {
  console.log(`Applying migration ${migration.id}: ${migration.name}`);

  db.transaction(() => {
    try {
      migration.up(db);
      db.prepare("INSERT INTO migrations (id, name) VALUES (?, ?)").run(
        migration.id,
        migration.name,
      );
      console.log(`✅ Migration ${migration.id} applied successfully`);
    } catch (error) {
      console.error(`❌ Migration ${migration.id} failed:`, error);
      throw error;
    }
  })();
}

export function runMigrations(db: Database.Database, migrations: Migration[]) {
  initMigrationsTable(db);
  const applied = getAppliedMigrations(db);

  const pending = migrations.filter((m) => !applied.includes(m.id));

  if (pending.length === 0) {
    console.log("✅ All migrations already applied");
    return;
  }

  console.log(`📦 Running ${pending.length} pending migration(s)...`);

  for (const migration of pending) {
    applyMigration(db, migration);
  }

  console.log("✅ All migrations completed");
}
