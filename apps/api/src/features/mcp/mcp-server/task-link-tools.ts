import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TaskService } from "../../task/task.service.js";
import { jsonText } from "./utils.js";

export function registerTaskLinkTools(
  server: McpServer,
  taskSvc: TaskService,
  userId: string,
) {
  server.registerTool(
    "link_tasks",
    {
      description: "Add a link between two tasks",
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        linkedTaskId: z.string().describe("ID of the task to link to"),
      },
    },
    ({ taskId, linkedTaskId }) =>
      jsonText(taskSvc.addLink(taskId, linkedTaskId, userId)),
  );

  server.registerTool(
    "unlink_tasks",
    {
      description: "Remove a link between two tasks",
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        linkedTaskId: z.string().describe("ID of the linked task to remove"),
      },
    },
    ({ taskId, linkedTaskId }) =>
      jsonText(taskSvc.removeLink(taskId, linkedTaskId, userId)),
  );
}
