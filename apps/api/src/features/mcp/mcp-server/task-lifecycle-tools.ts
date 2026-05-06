import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Column } from "@kanban/shared";
import type { TaskService } from "../../task/task.service.js";
import { COLUMN_VALUES, jsonText } from "./utils.js";

export function registerTaskLifecycleTools(
  server: McpServer,
  taskSvc: TaskService,
  userId: string,
) {
  server.registerTool(
    "move_task",
    {
      description:
        'Move a task to a different column. Moving to "doing" requires a doer assigned.',
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        column: z.enum(COLUMN_VALUES).describe("Target column"),
      },
    },
    ({ taskId, column }) =>
      jsonText(
        taskSvc.moveTask(taskId, userId, { column: column as Column }, true),
      ),
  );

  server.registerTool(
    "archive_task",
    {
      description: "Archive a task (only works for tasks in 'done' column)",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        taskId: z.string().describe("Task ID"),
      },
    },
    ({ projectId, taskId }) => {
      taskSvc.archiveTasks(projectId, [taskId], userId, true);
      return jsonText({ archived: taskId });
    },
  );

  server.registerTool(
    "list_archived_tasks",
    {
      description: "List archived tasks in a project",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        search: z.string().optional().describe("Search in archived tasks"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Max elements per call"),
      },
    },
    ({ projectId, search, page, limit }) =>
      jsonText(
        taskSvc.listArchivedTasks(projectId, {
          ...(search !== undefined ? { search } : {}),
          page,
          limit,
        }),
      ),
  );

  server.registerTool(
    "restore_task",
    {
      description: "Restore an archived task",
      inputSchema: { taskId: z.string().describe("Task ID") },
    },
    ({ taskId }) => jsonText(taskSvc.restoreTask(taskId, userId, true)),
  );
}
