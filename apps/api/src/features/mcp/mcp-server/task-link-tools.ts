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
      description:
        "Add a structured bidirectional link between two tasks. In Markdown descriptions and wiki pages, reference tasks with [label](task://<TASK_UUID>).",
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
      description:
        "Remove a structured bidirectional link between two tasks. This does not rewrite Markdown task:// links in task descriptions or wiki pages.",
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        linkedTaskId: z.string().describe("ID of the linked task to remove"),
      },
    },
    ({ taskId, linkedTaskId }) =>
      jsonText(taskSvc.removeLink(taskId, linkedTaskId, userId)),
  );
}
