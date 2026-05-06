import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AppDb, Broadcaster } from "../../types.js";
import { OrganizationService } from "../organization/organization.service.js";
import { ProjectService } from "../project/project.service.js";
import { TaskService } from "../task/task.service.js";
import { WikiService } from "../wiki/wiki.service.js";
import { registerMcpResources } from "./mcp-server/resources.js";
import { registerOrganizationTools } from "./mcp-server/organization-tools.js";
import { registerProjectTools } from "./mcp-server/project-tools.js";
import { registerTaskCrudTools } from "./mcp-server/task-crud-tools.js";
import { registerTaskLifecycleTools } from "./mcp-server/task-lifecycle-tools.js";
import { registerTaskLinkTools } from "./mcp-server/task-link-tools.js";
import { registerTaskListTools } from "./mcp-server/task-list-tools.js";
import { registerWikiTools } from "./mcp-server/wiki-tools.js";

/**
 * Creates a per-connection MCP server instance with all tools registered
 * for the given authenticated user.
 */
export function createMcpServer(
  userId: string,
  db: AppDb,
  broadcast: Broadcaster,
): McpServer {
  const orgSvc = new OrganizationService(db);
  const projectSvc = new ProjectService(db, broadcast);
  const taskSvc = new TaskService(db, broadcast);
  const wikiSvc = new WikiService(db, broadcast);
  const server = new McpServer(
    { name: "kanban", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  registerOrganizationTools(server, orgSvc, userId);
  registerProjectTools(server, projectSvc);
  registerTaskListTools(server, taskSvc);
  registerTaskCrudTools(server, taskSvc, userId);
  registerTaskLifecycleTools(server, taskSvc, userId);
  registerTaskLinkTools(server, taskSvc, userId);
  registerWikiTools(server, wikiSvc, userId);
  registerMcpResources(server, taskSvc);

  return server;
}
