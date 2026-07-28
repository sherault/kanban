import {
  ResourceTemplate,
  type McpServer,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type { TaskService } from "../../task/task.service.js";
import { DEFAULT_LIMIT_PER_COLUMN, renderBoard } from "./board-render.js";

export function registerMcpResources(server: McpServer, taskSvc: TaskService) {
  server.resource(
    "board",
    new ResourceTemplate("kanban://projects/{projectId}/board", {
      list: undefined,
    }),
    (_uri, { projectId }) => {
      const id = String(projectId);
      return {
        contents: [
          {
            uri: `kanban://projects/${id}/board`,
            text: renderBoard(
              taskSvc.listTasks(id),
              id,
              DEFAULT_LIMIT_PER_COLUMN,
            ),
            mimeType: "text/plain",
          },
        ],
      };
    },
  );
}
