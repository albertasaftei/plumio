import * as z from "zod";

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  username: z.string().min(1),
  email: z.email(),
  password: z.string().min(8),
  organizationName: z.string().optional(),
});

export const updateProfileSchema = z.object({
  username: z.string().min(1).max(50),
});
