import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TaskService } from "../../task/task.service.js";
import { COLUMN_VALUES, jsonText } from "./utils.js";

export function registerTaskListTools(server: McpServer, taskSvc: TaskService) {
  server.registerTool(
    "list_tasks",
    {
      description:
        "List tasks in a project, with optional filters and pagination. Tasks are always ordered by due date (endDate) ascending.",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        column: z.enum(COLUMN_VALUES).optional().describe("Filter by column"),
        tag: z.string().optional().describe("Filter by tag"),
        doerId: z.string().optional().describe("Filter by doer user ID"),
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
          .max(20)
          .default(10)
          .describe("Max elements per call (1-20, default 10)"),
      },
    },
    ({ projectId, column, tag, doerId, page, limit, search }) => {
      let tasks = taskSvc.listTasks(projectId, { search });
      if (column) tasks = tasks.filter((task) => task.column === column);
      if (tag) tasks = tasks.filter((task) => task.tags.includes(tag));
      if (doerId) tasks = tasks.filter((task) => task.doer?.id === doerId);

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
}
