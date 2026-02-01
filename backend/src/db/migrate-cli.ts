import Database from "better-sqlite3";
import { runMigrations, getAppliedMigrations } from "./migrations.js";
import { allMigrations } from "./migrations/index.js";
import fs from "fs";

// Create a separate database connection for CLI (don't import from index.ts)
const DB_PATH = process.env.DB_PATH || "./data/plumio.db";
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

const command = process.argv[2];

switch (command) {
  case "status":
    const applied = getAppliedMigrations(db);
    console.log(`\n📊 Migration Status:`);
    console.log(`Applied: ${applied.length}`);
    console.log(`Pending: ${allMigrations.length - applied.length}`);
    console.log(`\nApplied migrations:`);
    applied.forEach((id) => {
      const migration = allMigrations.find((m) => m.id === id);
      console.log(`  ✅ ${id}: ${migration?.name || "unknown"}`);
    });
    console.log(`\nPending migrations:`);
    console.log(allMigrations);
    allMigrations
      .filter((m) => !applied.includes(m.id))
      .forEach((m) => {
        console.log(`  ⏳ ${m.id}: ${m.name}`);
      });
    break;

  case "run":
    runMigrations(db, allMigrations);
    break;

  case "create":
    const name = process.argv[3];
    if (!name) {
      console.error("❌ Please provide a migration name");
      process.exit(1);
    }
    const nextId = allMigrations.length + 1;
    const filename = `${String(nextId).padStart(3, "0")}_${name}.ts`;
    const template = `import type { Migration } from "../migrations";

export const migration: Migration = {
  id: ${nextId},
  name: "${name}",
  up: (db) => {
    // TODO: Add migration logic here
    db.exec(\`
      -- Your SQL here
    \`);
  },
  down: (db) => {
    // Optional: Add rollback logic
  }
};
`;
    fs.writeFileSync(`src/db/migrations/${filename}`, template);
    console.log(`✅ Created migration: ${filename}`);
    console.log(`Don't forget to add it to migrations/index.ts!`);
    break;

  default:
    console.log(`
Usage: npm run migrate <command>

Commands:
  status    Show migration status
  run       Run pending migrations
  create    Create a new migration file
    `);
}

db.close();
