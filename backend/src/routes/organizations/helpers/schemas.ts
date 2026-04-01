import * as z from "zod";

export const getOrgParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
});

export const updateOrgParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});

export const createOrgParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});

export const addMemberSchema = z.object({
  username: z.string().min(1),
  role: z.enum(["admin", "member"]).optional(),
});

export const addMemberParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});

export const updateMemberParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
  userId: z.string().transform((val) => parseInt(val)),
});

export const updateMemberSchema = z.object({
  role: z.enum(["admin", "member"]),
});

export const getUserRoleParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});

export const removeMemberParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
  userId: z.string().transform((val) => parseInt(val)),
});
