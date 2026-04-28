import type { Migration } from "../migrations";

export const addOrgDiscovery: Migration = {
  id: 11,
  name: "add-org-discovery",
  up: (db) => {
    db.exec(`
      ALTER TABLE organizations ADD COLUMN discoverable INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE organizations ADD COLUMN auto_accept INTEGER NOT NULL DEFAULT 0;
    `);
    // Personal orgs should not be discoverable by default
    db.exec(`
      UPDATE organizations SET discoverable = 0 WHERE slug LIKE '%-personal';
    `);
    console.log(
      "  ✅ Added discoverable and auto_accept columns to organizations",
    );
  },
  down: (db) => {
    db.exec(`
      ALTER TABLE organizations DROP COLUMN discoverable;
      ALTER TABLE organizations DROP COLUMN auto_accept;
    `);
  },
};
