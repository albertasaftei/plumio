import type { Migration } from "../migrations";
import { addDeletedDocuments } from "./001-add-deleted-documents.js";

// All migrations in order - put them inside this folder and add them here
export const allMigrations: Migration[] = [addDeletedDocuments];
