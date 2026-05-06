import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskService } from "../../task/task.service.js";

export function registerMcpResources(server: McpServer, taskSvc: TaskService) {
  server.resource(
    "board",
    new ResourceTemplate("kanban://projects/{projectId}/board", {
      list: undefined,
    }),
    (_uri, { projectId }) => {
      const id = String(projectId);
      const tasks = taskSvc.listTasks(id);
      const columns = ["ideas", "todo", "doing", "done"] as const;
      const lines: string[] = [`Board: project ${id}`, ""];
      for (const column of columns) {
        const columnTasks = tasks.filter((task) => task.column === column);
        lines.push(`## ${column.toUpperCase()} (${columnTasks.length})`);
        for (const task of columnTasks) {
          const doer = task.doer ? ` [@${task.doer.displayName}]` : "";
          lines.push(`- [${task.id}] ${task.title}${doer}`);
        }
        lines.push("");
      }
      return {
        contents: [
          {
            uri: `kanban://projects/${id}/board`,
            text: lines.join("\n"),
            mimeType: "text/plain",
          },
        ],
      };
    },
  );
}
