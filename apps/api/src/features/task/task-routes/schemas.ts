import { z } from "zod";

export const columnEnum = z.enum(["ideas", "todo", "doing", "done"]);

export const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  startDate: z.string(),
  endDate: z.string(),
  backgroundColor: z.string().nullable().optional(),
  globalSubject: z.string().nullable().optional(),
  column: columnEnum.optional(),
  doerId: z.string().uuid().nullable().optional(),
  validatorId: z.string().uuid().nullable().optional(),
});

export const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  backgroundColor: z.string().nullable().optional(),
  globalSubject: z.string().nullable().optional(),
  doerId: z.string().uuid().nullable().optional(),
  validatorId: z.string().uuid().nullable().optional(),
});

export const moveSchema = z.object({
  column: columnEnum,
});
