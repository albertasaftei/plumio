import * as z from "zod";
import { WebhookEvent } from "../../../utils/webhooks.js";

export const VALID_EVENTS: WebhookEvent[] = [
  "document.created",
  "document.updated",
  "document.deleted",
  "document.renamed",
  "document.archived",
  "document.unarchived",
  "document.restored",
  "document.tagged",
  "document.untagged",
  "folder.created",
  "folder.deleted",
  "tag.created",
  "tag.updated",
  "tag.deleted",
];

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(100),
  url: z.string().url(),
  secret: z.string().min(8).max(256),
  events: z
    .array(z.enum(VALID_EVENTS as [WebhookEvent, ...WebhookEvent[]]))
    .min(1),
});

export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  url: z.string().url().optional(),
  secret: z.string().min(8).max(256).optional(),
  events: z
    .array(z.enum(VALID_EVENTS as [WebhookEvent, ...WebhookEvent[]]))
    .min(1)
    .optional(),
  active: z.boolean().optional(),
});

export const webhookIdParamSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const deliveriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
