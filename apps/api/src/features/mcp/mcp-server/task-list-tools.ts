import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TaskService } from "../../task/task.service.js";
import { COLUMN_VALUES, jsonText, textResult } from "./utils.js";

const HISTORY_VALUE_LIMIT = 500;

function truncateHistoryValue(value: string | null) {
  if (value === null) return null;
  return value.length > HISTORY_VALUE_LIMIT
    ? `${value.slice(0, HISTORY_VALUE_LIMIT)}…[truncated]`
    : value;
}

export function registerTaskListTools(server: McpServer, taskSvc: TaskService) {
  server.registerTool(
    "get_task",
    {
      description:
        "Get a single task by its ID, including tags, links, watchers, advisors and assignments. Use this instead of list_tasks when the task ID is already known. Archived tasks are returned with an extra archived: true field.",
      inputSchema: { taskId: z.string().describe("Task ID") },
    },
    ({ taskId }) => {
      const task = taskSvc.getTask(taskId);
      if (!task) return textResult("Task not found", true);
      return jsonText(task.archivedAt ? { ...task, archived: true } : task);
    },
  );

  server.registerTool(
    "list_tasks",
    {
      description:
        "List tasks in a project, with optional filters and pagination. Tasks are always ordered by due date (endDate) ascending.",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        column: z.enum(COLUMN_VALUES).optional().describe("Filter by column"),
        tag: z
          .string()
          .optional()
          .describe("Deprecated alias for tags — filter by a single tag"),
        tags: z
          .array(z.string())
          .optional()
          .describe("Filter by tags — a task must carry every listed tag"),
        doerId: z.string().optional().describe("Filter by doer user ID"),
        validatorId: z
          .string()
          .optional()
          .describe("Filter by validator user ID"),
        search: z
          .string()
          .optional()
          .describe(
            "Search in title, description, globalSubject and objective",
          ),
        page: z.number().int().min(1).default(1).describe("Page number"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(10)
          .describe("Max elements per call (1-50, default 10)"),
      },
    },
    ({
      projectId,
      column,
      tag,
      tags,
      doerId,
      validatorId,
      page,
      limit,
      search,
    }) => {
      const allTags = [...(tags ?? []), ...(tag ? [tag] : [])];
      let tasks = taskSvc.listTasks(projectId, { search });
      if (column) tasks = tasks.filter((task) => task.column === column);
      if (allTags.length)
        tasks = tasks.filter((task) =>
          allTags.every((wanted) => task.tags.includes(wanted)),
        );
      if (doerId) tasks = tasks.filter((task) => task.doer?.id === doerId);
      if (validatorId)
        tasks = tasks.filter((task) => task.validator?.id === validatorId);

      const offset = (page - 1) * limit;
      return jsonText({
        tasks: tasks.slice(offset, offset + limit),
        pagination: {
          total: tasks.length,
          page,
          limit,
          totalPages: Math.ceil(tasks.length / limit),
        },
      });
    },
  );

  server.registerTool(
    "get_task_history",
    {
      description:
        "Get the change history of a task, newest first — who changed which field, from what to what, and when. Use it to resume work after an interruption or to reconstruct how a task progressed. Long values are truncated to 500 characters.",
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        field: z
          .string()
          .optional()
          .describe(
            "Filter by changed field name, e.g. column, title, description, doerId",
          ),
        page: z.number().int().min(1).default(1).describe("Page number"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(50)
          .describe("Max entries per call (1-100, default 50)"),
      },
    },
    ({ taskId, field, page, limit }) => {
      if (!taskSvc.getTask(taskId)) return textResult("Task not found", true);

      let entries = taskSvc.getTaskHistory(taskId);
      if (field) entries = entries.filter((entry) => entry.field === field);

      const total = entries.length;
      const offset = (page - 1) * limit;
      return jsonText({
        taskId,
        entries: entries.slice(offset, offset + limit).map((entry) => ({
          field: entry.field,
          oldValue: truncateHistoryValue(entry.oldValue),
          newValue: truncateHistoryValue(entry.newValue),
          actor: entry.actor,
          changedAt: entry.changedAt,
          batchId: entry.batchId,
        })),
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    },
  );
}
