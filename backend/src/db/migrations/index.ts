import type { Migration } from "../migrations";
import { addDeletedDocuments } from "./001-add-deleted-documents.js";
import { addSettings } from "./002-add-settings.js";
import { addIsAdmin } from "./003-add-is-admin.js";
import { addAttachments } from "./004-add-attachments.js";
import { addSortOrder } from "./005-add-sort-order.js";
import { addTags } from "./006-add-tags.js";
import { addPasswordResetTokens } from "./007-add-password-reset-tokens.js";
import { addEmailChangeTokens } from "./008-add-email-change-tokens.js";

// All migrations in order - put them inside this folder and add them here
export const allMigrations: Migration[] = [
  addDeletedDocuments,
  addSettings,
  addIsAdmin,
  addAttachments,
  addSortOrder,
  addTags,
  addPasswordResetTokens,
  addEmailChangeTokens,
];
