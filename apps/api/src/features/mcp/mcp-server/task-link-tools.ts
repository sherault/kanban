import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { TaskService } from "../../task/task.service.js";
import { COMPACT_ACK_GUIDANCE, taskResult, verboseInput } from "./utils.js";

export function registerTaskLinkTools(
  server: McpServer,
  taskSvc: TaskService,
  userId: string,
) {
  server.registerTool(
    "link_tasks",
    {
      description: `Add a structured bidirectional link between two tasks. In Markdown descriptions and wiki pages, reference tasks with [label](task://<TASK_UUID>). ${COMPACT_ACK_GUIDANCE}`,
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        linkedTaskId: z.string().describe("ID of the task to link to"),
        verbose: verboseInput,
      },
    },
    ({ taskId, linkedTaskId, verbose }) =>
      taskResult(taskSvc.addLink(taskId, linkedTaskId, userId), verbose),
  );

  server.registerTool(
    "unlink_tasks",
    {
      description: `Remove a structured bidirectional link between two tasks. This does not rewrite Markdown task:// links in task descriptions or wiki pages. ${COMPACT_ACK_GUIDANCE}`,
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        linkedTaskId: z.string().describe("ID of the linked task to remove"),
        verbose: verboseInput,
      },
    },
    ({ taskId, linkedTaskId, verbose }) =>
      taskResult(taskSvc.removeLink(taskId, linkedTaskId, userId), verbose),
  );
}
