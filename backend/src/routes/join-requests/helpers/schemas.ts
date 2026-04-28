import * as z from "zod";

export const createJoinRequestSchema = z.object({
  organizationId: z.number().int().positive(),
  message: z.string().max(500).optional(),
});

export const joinRequestIdParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

export const orgJoinRequestsParamsSchema = z.object({
  orgId: z.coerce.number().int().positive(),
});
