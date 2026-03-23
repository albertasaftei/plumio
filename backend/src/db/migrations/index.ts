import type { Migration } from "../migrations";
import { addDeletedDocuments } from "./001-add-deleted-documents.js";
import { addSettings } from "./002-add-settings.js";
import { addIsAdmin } from "./003-add-is-admin.js";
import { addAttachments } from "./004-add-attachments.js";

// All migrations in order - put them inside this folder and add them here
export const allMigrations: Migration[] = [
  addDeletedDocuments,
  addSettings,
  addIsAdmin,
  addAttachments,
];
