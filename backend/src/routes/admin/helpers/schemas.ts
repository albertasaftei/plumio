import * as z from "zod";

export const registerSchema = z.object({
  username: z.string().min(1, "Username is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  isAdmin: z.boolean().optional().default(false),
});

export const updateUserParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});

export const updateUserSchema = z.object({
  isAdmin: z.boolean(),
});

export const deleteUserParamsSchema = z.object({
  id: z.string().transform((val) => parseInt(val)),
});

export const updateSettingSchema = z.object({
  key: z.string().min(1),
  value: z.string(),
});
