import * as z from "zod";

export const saveDocumentSchema = z.object({
  // For existing-doc saves: full path
  path: z.string().optional(),
  // For new-doc creation: folder + raw user-typed name (sanitized server-side)
  folder: z.string().optional(),
  name: z.string().optional(),
  content: z.string(),
  isNew: z.boolean().optional(),
});

export const createFolderSchema = z.object({
  // Prefer folder+name so the server can sanitize the user-typed name
  folder: z.string().optional(),
  name: z.string().optional(),
  // Fallback: pre-built full path (legacy / internal use)
  path: z.string().optional(),
});

export const deleteDocumentSchema = z.object({
  path: z.string().min(1),
});

export const renameDocumentSchema = z.object({
  oldPath: z.string().min(1),
  // Prefer newName so the server can sanitize the user-typed name
  newName: z.string().optional(),
  // Fallback: full pre-built new path (legacy / internal use)
  newPath: z.string().optional(),
});

export const moveDocumentSchema = z.object({
  sourcePath: z.string().min(1),
  destinationFolder: z.string(),
});

export const moveCrossOrgSchema = z.object({
  sourcePath: z.string().min(1),
  targetOrgId: z.number().int().positive(),
});

export const colorDocumentSchema = z.object({
  path: z.string().min(1),
  color: z.string().or(z.null()),
});

export const favoriteDocumentSchema = z.object({
  path: z.string().min(1),
  favorite: z.boolean(),
});

export const importDocumentSchema = z.object({
  file: z.instanceof(File),
});

export const archiveDocumentSchema = z.object({
  path: z.string().min(1),
});

export const unarchiveDocumentSchema = z.object({
  path: z.string().min(1),
});

export const deleteArchivedDocumentSchema = z.object({
  path: z.string().min(1),
});

export const restoreDocumentSchema = z.object({
  path: z.string().min(1),
});

export const permanentlyDeleteDocumentSchema = z.object({
  path: z.string().min(1),
});

export const duplicateItemSchema = z.object({
  path: z.string().min(1),
});

export const reorderDocumentSchema = z.object({
  sourcePath: z.string().min(1),
  targetPath: z.string().min(1),
  operation: z.enum(["reorder-before", "reorder-after", "make-child"]),
});
