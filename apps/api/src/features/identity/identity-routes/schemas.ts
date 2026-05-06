import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  displayName: z.string().min(1).max(100),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  totpCode: z.string().optional(),
});

export const totpCodeSchema = z.object({
  code: z.string().length(6),
});

export const emailSchema = z.object({ email: z.string().email() });

export const resetPasswordSchema = z.object({
  token: z.string().min(1),
  password: z.string().min(8),
});

export const settingsSchema = z.object({
  maxOpenPanels: z.number().min(1).max(10).optional(),
  enableNotifications: z.boolean().optional(),
  maxNotifications: z.number().min(1).max(5).optional(),
  notificationDuration: z.number().min(1).max(30).optional(),
});
