import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TaskService } from "../../task/task.service.js";
import {
  parseTimestamp,
  selectSections,
  withoutDescription,
} from "./task-description.js";
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
        'Get a single task by its ID, including tags, links, watchers, advisors and assignments. Use this instead of list_tasks when the task ID is already known. Archived tasks are returned with an extra archived: true field. Pass sections (e.g. ["## Fichiers", "## Dépendances"]) to receive only those level-2 Markdown sections of the description, in their original order, plus a missingSections array naming the requested sections not found. Pass ifUpdatedSince (ISO-8601) to receive only { id, updatedAt, unchanged: true } when the task has not been updated after that date.',
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        sections: z
          .array(z.string())
          .optional()
          .describe(
            'Level-2 Markdown headings to keep from the description, written in full, e.g. ["## Fichiers", "## Dépendances"]. The returned description holds only these sections, in their original order; requested sections not found are listed in missingSections.',
          ),
        ifUpdatedSince: z
          .string()
          .refine((value) => !Number.isNaN(parseTimestamp(value)), {
            message: "ifUpdatedSince must be an ISO-8601 date",
          })
          .optional()
          .describe(
            "ISO-8601 date (UTC when no zone is given). When the task updatedAt is at or before it, only { id, updatedAt, unchanged: true } is returned.",
          ),
      },
    },
    ({ taskId, sections, ifUpdatedSince }) => {
      const task = taskSvc.getTask(taskId);
      if (!task) return textResult("Task not found", true);
      if (
        ifUpdatedSince !== undefined &&
        parseTimestamp(task.updatedAt) <= parseTimestamp(ifUpdatedSince)
      )
        return jsonText({
          id: task.id,
          updatedAt: task.updatedAt,
          unchanged: true,
        });

      const result = sections
        ? { ...task, ...selectSections(task.description, sections) }
        : task;
      return jsonText(task.archivedAt ? { ...result, archived: true } : result);
    },
  );

  server.registerTool(
    "list_tasks",
    {
      description:
        "List tasks in a project, with optional filters and pagination. Tasks are always ordered by due date (endDate) ascending. Tasks come without their description but with its descriptionLength; pass includeDescription: true for the full description, or call get_task.",
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
        includeDescription: z
          .boolean()
          .default(false)
          .describe(
            "Include each task description (default false: descriptionLength only)",
          ),
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
      includeDescription,
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
        tasks: tasks
          .slice(offset, offset + limit)
          .map((task) =>
            includeDescription ? task : withoutDescription(task),
          ),
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
        'Get the change history of a task, newest first — who changed which field, from what to what, when, and from where (source: "mcp", "web", or null for entries recorded before source tracking). Use it to resume work after an interruption or to reconstruct how a task progressed. Long values are truncated to 500 characters.',
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        field: z
          .string()
          .optional()
          .describe(
            'Filter by changed field name, e.g. column, title, description, doerId. Use "note" to read the task log book: one entry per append_task_note call, holding only the appended text.',
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
          source: entry.source,
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
