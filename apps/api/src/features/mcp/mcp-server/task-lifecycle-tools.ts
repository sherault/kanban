import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Column } from "@kanban/shared";
import type { TaskService } from "../../task/task.service.js";
import {
  COLUMN_VALUES,
  COMPACT_ACK_GUIDANCE,
  jsonText,
  taskResult,
  verboseInput,
} from "./utils.js";

export function registerTaskLifecycleTools(
  server: McpServer,
  taskSvc: TaskService,
  userId: string,
) {
  server.registerTool(
    "move_task",
    {
      description: `Move a task to a different column. Moving to "doing" is rejected unless the task already has a doer — assign one with update_task first. ${COMPACT_ACK_GUIDANCE}`,
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        column: z.enum(COLUMN_VALUES).describe("Target column"),
        verbose: verboseInput,
      },
    },
    ({ taskId, column, verbose }) =>
      taskResult(
        taskSvc.moveTask(taskId, userId, { column: column as Column }, true),
        verbose,
      ),
  );

  server.registerTool(
    "transfer_task",
    {
      description: `Transfer a task to another project of the same organization. The task keeps its id, column, history, tags, links and participants, lands at the end of its column, and stays archived if it was. The transfer is recorded in the task history. ${COMPACT_ACK_GUIDANCE}`,
      inputSchema: {
        taskId: z.string().describe("Task ID (archived tasks accepted)"),
        targetProjectId: z
          .string()
          .describe("Destination project ID, in the task's organization"),
        verbose: verboseInput,
      },
    },
    ({ taskId, targetProjectId, verbose }) =>
      taskResult(
        taskSvc.transferTask(taskId, userId, { targetProjectId }, true),
        verbose,
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
      description: `Restore an archived task. ${COMPACT_ACK_GUIDANCE}`,
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        verbose: verboseInput,
      },
    },
    ({ taskId, verbose }) =>
      taskResult(taskSvc.restoreTask(taskId, userId, true), verbose),
  );
}
