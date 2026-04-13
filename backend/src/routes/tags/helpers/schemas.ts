import * as z from "zod";

export const createTagSchema = z.object({
  name: z.string().min(1).max(50).trim(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  description: z.string().max(200).nullable().optional(),
});

export const updateTagSchema = z.object({
  name: z.string().min(1).max(50).trim().optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .nullable()
    .optional(),
  description: z.string().max(200).nullable().optional(),
});

export const setDocumentTagsSchema = z.object({
  path: z.string().min(1),
  tagIds: z.array(z.number().int().positive()),
});

export const bulkTagSchema = z.object({
  documentPaths: z.array(z.string().min(1)).min(1),
  tagId: z.number().int().positive(),
  action: z.enum(["add", "remove"]),
});
