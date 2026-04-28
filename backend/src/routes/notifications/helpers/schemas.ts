import * as z from "zod";

export const notificationIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const listNotificationsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
