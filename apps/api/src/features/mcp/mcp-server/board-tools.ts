import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TaskService } from "../../task/task.service.js";
import { DEFAULT_LIMIT_PER_COLUMN, renderBoard } from "./board-render.js";
import { textResult } from "./utils.js";

export function registerBoardTools(server: McpServer, taskSvc: TaskService) {
  server.registerTool(
    "get_board",
    {
      description:
        "Full board snapshot in one call — every column with each task's doer, deadline, tags and colour. Use this at session start instead of several paginated list_tasks calls. Archived tasks are excluded.",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        limitPerColumn: z
          .number()
          .int()
          .min(1)
          .max(200)
          .default(DEFAULT_LIMIT_PER_COLUMN)
          .describe("Max tasks rendered per column (1-200, default 50)"),
      },
    },
    ({ projectId, limitPerColumn }) =>
      textResult(
        renderBoard(taskSvc.listTasks(projectId), projectId, limitPerColumn),
      ),
  );
}
