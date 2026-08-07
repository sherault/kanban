import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ProjectService } from "../../project/project.service.js";
import { jsonText } from "./utils.js";

export function registerProjectTools(
  server: McpServer,
  projectSvc: ProjectService,
  userId: string,
) {
  server.registerTool(
    "list_projects",
    {
      description:
        "List all projects in an organization. Archived projects are returned with an extra archived: true field.",
      inputSchema: { orgId: z.string().describe("Organization ID") },
    },
    ({ orgId }) =>
      jsonText(
        projectSvc
          .listProjects(orgId)
          .map((project) =>
            project.archivedAt ? { ...project, archived: true } : project,
          ),
      ),
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
    ({ orgId, name }) =>
      jsonText(projectSvc.createProject(orgId, { name }, userId)),
  );

  server.registerTool(
    "archive_project",
    {
      description:
        "Archive a project. The project stays fully editable but is hidden from the main project lists and marked as archived on its knowledge base page.",
      inputSchema: {
        orgId: z.string().describe("Organization ID"),
        projectId: z.string().describe("Project ID"),
      },
    },
    ({ orgId, projectId }) =>
      jsonText(projectSvc.archiveProject(orgId, projectId, userId)),
  );

  server.registerTool(
    "restore_project",
    {
      description: "Restore an archived project back to active",
      inputSchema: {
        orgId: z.string().describe("Organization ID"),
        projectId: z.string().describe("Project ID"),
      },
    },
    ({ orgId, projectId }) =>
      jsonText(projectSvc.restoreProject(orgId, projectId, userId)),
  );
}
