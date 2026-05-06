import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ProjectService } from "../../project/project.service.js";
import { jsonText } from "./utils.js";

export function registerProjectTools(
  server: McpServer,
  projectSvc: ProjectService,
) {
  server.registerTool(
    "list_projects",
    {
      description: "List all projects in an organization",
      inputSchema: { orgId: z.string().describe("Organization ID") },
    },
    ({ orgId }) => jsonText(projectSvc.listProjects(orgId)),
  );

  server.registerTool(
    "create_project",
    {
      description: "Create a new project in an organization",
      inputSchema: {
        orgId: z.string().describe("Organization ID"),
        name: z.string().min(1).max(200).describe("Project name"),
      },
    },
    ({ orgId, name }) => jsonText(projectSvc.createProject(orgId, { name })),
  );
}
