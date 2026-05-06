import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Column } from "@kanban/shared";
import type { TaskService } from "../../task/task.service.js";
import { jsonText } from "./utils.js";

export function registerTaskCrudTools(
  server: McpServer,
  taskSvc: TaskService,
  userId: string,
) {
  server.registerTool(
    "create_task",
    {
      description: "Create a new task in a project",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        title: z.string().min(1).max(500).describe("Task title"),
        description: z
          .string()
          .optional()
          .describe("Task description (markdown)"),
        objective: z.string().optional().describe("Task objective"),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Start date (YYYY-MM-DD)"),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("End date (YYYY-MM-DD)"),
        column: z
          .enum(["ideas", "todo"] as const)
          .optional()
          .describe("Target column (default: todo)"),
        backgroundColor: z
          .string()
          .optional()
          .describe("Background color hex e.g. #f97316"),
        globalSubject: z.string().optional().describe("Global subject / epic"),
        doerId: z.string().optional().describe("Assign a doer user ID"),
        validatorId: z
          .string()
          .optional()
          .describe("Assign a validator user ID"),
        tags: z.array(z.string()).optional().describe("List of tags"),
      },
    },
    ({
      projectId,
      column,
      description,
      objective,
      backgroundColor,
      globalSubject,
      doerId,
      validatorId,
      ...input
    }) =>
      jsonText(
        taskSvc.createTask(
          projectId,
          userId,
          {
            ...input,
            description: description ?? null,
            objective: objective ?? null,
            column: (column as Column | undefined) ?? "todo",
            backgroundColor: backgroundColor ?? null,
            globalSubject: globalSubject ?? null,
            doerId: doerId ?? null,
            validatorId: validatorId ?? null,
          },
          true,
        ),
      ),
  );

  server.registerTool(
    "update_task",
    {
      description: "Update one or more fields of an existing task",
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        title: z.string().min(1).max(500).optional().describe("New title"),
        description: z
          .string()
          .nullable()
          .optional()
          .describe("New description in Markdown (null to clear)"),
        objective: z
          .string()
          .nullable()
          .optional()
          .describe("New objective (null to clear)"),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("New start date"),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("New end date"),
        backgroundColor: z
          .string()
          .nullable()
          .optional()
          .describe("Background color (null to clear)"),
        globalSubject: z
          .string()
          .nullable()
          .optional()
          .describe("Global subject (null to clear)"),
        doerId: z
          .string()
          .nullable()
          .optional()
          .describe("Doer user ID (null to unassign)"),
        validatorId: z
          .string()
          .nullable()
          .optional()
          .describe("Validator user ID (null to unassign)"),
        tags: z.array(z.string()).optional().describe("New list of tags"),
      },
    },
    ({ taskId, ...fields }) =>
      jsonText(taskSvc.updateTask(taskId, userId, fields, true)),
  );

  server.registerTool(
    "delete_task",
    {
      description: "Delete a task",
      inputSchema: { taskId: z.string().describe("Task ID") },
    },
    ({ taskId }) => {
      taskSvc.deleteTask(taskId, userId, true);
      return jsonText({ deleted: taskId });
    },
  );
}
