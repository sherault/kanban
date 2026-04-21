import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppDb, Broadcaster } from "../../types.js";
import { OrganizationService } from "../organization/organization.service.js";
import { ProjectService } from "../project/project.service.js";
import { TaskService } from "../task/task.service.js";
import type { Column } from "@kanban/shared";

const COLUMN_VALUES = ["ideas", "todo", "doing", "done"] as const;

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

  const server = new McpServer(
    { name: "kanban", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  // ── Organization tools ──────────────────────────────────────────────────

  server.registerTool(
    "list_organizations",
    { description: "List all organizations the current user belongs to" },
    () => {
      const orgs = orgSvc.listOrgs(userId);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(orgs, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "create_organization",
    {
      description: "Create a new organization",
      inputSchema: {
        name: z.string().min(1).max(100).describe("Organization name"),
        website: z.string().url().optional().describe("Optional website URL"),
      },
    },
    ({ name, website }) => {
      const org = orgSvc.createOrg(userId, { name, website: website ?? null });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(org, null, 2) },
        ],
      };
    },
  );

  // ── Project tools ───────────────────────────────────────────────────────

  server.registerTool(
    "list_projects",
    {
      description: "List all projects in an organization",
      inputSchema: { orgId: z.string().describe("Organization ID") },
    },
    ({ orgId }) => {
      const projects = projectSvc.listProjects(orgId);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(projects, null, 2) },
        ],
      };
    },
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
    ({ orgId, name }) => {
      const project = projectSvc.createProject(orgId, { name });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(project, null, 2) },
        ],
      };
    },
  );

  // ── Task tools ──────────────────────────────────────────────────────────

  server.registerTool(
    "list_tasks",
    {
      description:
        "List tasks in a project, with optional filters and pagination",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        column: z.enum(COLUMN_VALUES).optional().describe("Filter by column"),
        tag: z.string().optional().describe("Filter by tag"),
        doerId: z.string().optional().describe("Filter by doer user ID"),
        page: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe("Page number for pagination"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(20)
          .default(10)
          .describe("Max elements per call (1-20, default 10)"),
      },
    },
    ({ projectId, column, tag, doerId, page, limit }) => {
      let tasks = taskSvc.listTasks(projectId);
      if (column) tasks = tasks.filter((t) => t.column === column);
      if (tag) tasks = tasks.filter((t) => t.tags.includes(tag));
      if (doerId) tasks = tasks.filter((t) => t.doer?.id === doerId);

      const offset = (page - 1) * limit;
      const paginatedTasks = tasks.slice(offset, offset + limit);

      return {
        content: [
          {
            type: "text" as const,
            text: JSON.stringify(
              {
                tasks: paginatedTasks,
                pagination: {
                  total: tasks.length,
                  page,
                  limit,
                  totalPages: Math.ceil(tasks.length / limit),
                },
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );

  server.registerTool(
    "create_task",
    {
      description: "Create a new task in a project",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        title: z.string().min(1).max(500).describe("Task title"),
        description: z
          .string()
          .optional()
          .describe("Task description (markdown)"),
        objective: z.string().optional().describe("Task objective"),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("Start date (YYYY-MM-DD)"),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .describe("End date (YYYY-MM-DD)"),
        column: z
          .enum(["ideas", "todo"] as const)
          .optional()
          .describe("Target column (default: todo)"),
        backgroundColor: z
          .string()
          .optional()
          .describe("Background color hex e.g. #f97316"),
        globalSubject: z.string().optional().describe("Global subject / epic"),
      },
    },
    ({
      projectId,
      title,
      description,
      objective,
      startDate,
      endDate,
      column,
      backgroundColor,
      globalSubject,
    }) => {
      const task = taskSvc.createTask(
        projectId,
        userId,
        {
          title,
          description: description ?? null,
          objective: objective ?? null,
          startDate,
          endDate,
          column: (column as Column | undefined) ?? "todo",
          backgroundColor: backgroundColor ?? null,
          globalSubject: globalSubject ?? null,
        },
        true,
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(task, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "update_task",
    {
      description: "Update one or more fields of an existing task",
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        title: z.string().min(1).max(500).optional().describe("New title"),
        description: z
          .string()
          .nullable()
          .optional()
          .describe(
            "New description in Markdown (null to clear). Supports GFM: **bold**, *italic*, `code`, ## headings, - lists, ```code blocks```",
          ),
        objective: z
          .string()
          .nullable()
          .optional()
          .describe("New objective (null to clear)"),
        startDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("New start date"),
        endDate: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("New end date"),
        backgroundColor: z
          .string()
          .nullable()
          .optional()
          .describe("Background color (null to clear)"),
        globalSubject: z
          .string()
          .nullable()
          .optional()
          .describe("Global subject (null to clear)"),
        doerId: z
          .string()
          .nullable()
          .optional()
          .describe("Doer user ID (null to unassign)"),
        validatorId: z
          .string()
          .nullable()
          .optional()
          .describe("Validator user ID (null to unassign)"),
      },
    },
    ({ taskId, ...fields }) => {
      const task = taskSvc.updateTask(taskId, userId, fields, true);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(task, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "move_task",
    {
      description:
        'Move a task to a different column. Moving to "doing" requires a doer assigned.',
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        column: z.enum(COLUMN_VALUES).describe("Target column"),
      },
    },
    ({ taskId, column }) => {
      const task = taskSvc.moveTask(
        taskId,
        userId,
        {
          column: column as Column,
        },
        true,
      );
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(task, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "delete_task",
    {
      description: "Delete a task",
      inputSchema: { taskId: z.string().describe("Task ID") },
    },
    ({ taskId }) => {
      taskSvc.deleteTask(taskId, userId, true);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ deleted: taskId }) },
        ],
      };
    },
  );

  // ── Resources ────────────────────────────────────────────────────────────

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
      for (const col of columns) {
        const colTasks = tasks.filter((t) => t.column === col);
        lines.push(`## ${col.toUpperCase()} (${colTasks.length})`);
        for (const t of colTasks) {
          const doer = t.doer ? ` [@${t.doer.displayName}]` : "";
          lines.push(`- [${t.id}] ${t.title}${doer}`);
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

  return server;
}
