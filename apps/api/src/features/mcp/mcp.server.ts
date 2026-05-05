import {
  McpServer,
  ResourceTemplate,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { AppDb, Broadcaster } from "../../types.js";
import { OrganizationService } from "../organization/organization.service.js";
import { ProjectService } from "../project/project.service.js";
import { TaskService } from "../task/task.service.js";
import { WikiService } from "../wiki/wiki.service.js";
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
  const wikiSvc = new WikiService(db, broadcast);

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
        "List tasks in a project, with optional filters and pagination. Tasks are always ordered by due date (endDate) ascending.",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        column: z.enum(COLUMN_VALUES).optional().describe("Filter by column"),
        tag: z.string().optional().describe("Filter by tag"),
        doerId: z.string().optional().describe("Filter by doer user ID"),
        search: z
          .string()
          .optional()
          .describe(
            "Search in title, description, globalSubject and objective",
          ),
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
    ({ projectId, column, tag, doerId, page, limit, search }) => {
      let tasks = taskSvc.listTasks(projectId, { search });
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
        doerId: z.string().optional().describe("Assign a doer user ID"),
        validatorId: z
          .string()
          .optional()
          .describe("Assign a validator user ID"),
        tags: z.array(z.string()).optional().describe("List of tags"),
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
      doerId,
      validatorId,
      tags,
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
          doerId: doerId ?? null,
          validatorId: validatorId ?? null,
          tags,
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
        tags: z.array(z.string()).optional().describe("New list of tags"),
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
    "archive_task",
    {
      description: "Archive a task (only works for tasks in 'done' column)",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        taskId: z.string().describe("Task ID"),
      },
    },
    ({ projectId, taskId }) => {
      taskSvc.archiveTasks(projectId, [taskId], userId, true);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ archived: taskId }) },
        ],
      };
    },
  );

  server.registerTool(
    "list_archived_tasks",
    {
      description: "List archived tasks in a project",
      inputSchema: {
        projectId: z.string().describe("Project ID"),
        search: z.string().optional().describe("Search in archived tasks"),
        page: z.number().int().min(1).default(1).describe("Page number"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(50)
          .default(20)
          .describe("Max elements per call"),
      },
    },
    ({ projectId, search, page, limit }) => {
      const result = taskSvc.listArchivedTasks(projectId, {
        ...(search !== undefined ? { search } : {}),
        page,
        limit,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(result, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "restore_task",
    {
      description: "Restore an archived task",
      inputSchema: {
        taskId: z.string().describe("Task ID"),
      },
    },
    ({ taskId }) => {
      const task = taskSvc.restoreTask(taskId, userId, true);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(task, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "link_tasks",
    {
      description: "Add a link between two tasks",
      inputSchema: {
        taskId: z.string().describe("Task ID"),
        linkedTaskId: z.string().describe("ID of the task to link to"),
      },
    },
    ({ taskId, linkedTaskId }) => {
      const task = taskSvc.addLink(taskId, linkedTaskId, userId);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(task, null, 2) },
        ],
      };
    },
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
    ({ taskId, linkedTaskId }) => {
      const task = taskSvc.removeLink(taskId, linkedTaskId, userId);
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

  // ── Wiki tools ──────────────────────────────────────────────────────────

  server.registerTool(
    "list_wiki_pages",
    {
      description: "List all wiki pages in an organization",
      inputSchema: { orgId: z.string().describe("Organization ID") },
    },
    async ({ orgId }) => {
      const pages = await wikiSvc.listPages(orgId);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(pages, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "get_wiki_page",
    {
      description: "Get the full content of a wiki page",
      inputSchema: { pageId: z.string().describe("Wiki Page ID") },
    },
    async ({ pageId }) => {
      const page = await wikiSvc.getPage(pageId);
      if (!page) {
        return {
          content: [{ type: "text" as const, text: "Wiki page not found" }],
          isError: true,
        };
      }
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(page, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "create_wiki_page",
    {
      description: "Create a new wiki page",
      inputSchema: {
        orgId: z.string().describe("Organization ID"),
        title: z.string().min(1).max(200).describe("Page title"),
        content: z.string().describe("Page content (markdown)"),
        parentId: z.string().optional().describe("Optional parent page ID"),
        projectId: z
          .string()
          .optional()
          .describe("Optional project ID mapping"),
      },
    },
    async ({ orgId, title, content, parentId, projectId }) => {
      const page = await wikiSvc.createPage(orgId, userId, {
        title,
        content,
        parentId,
        projectId,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(page, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "update_wiki_page",
    {
      description: "Update an existing wiki page",
      inputSchema: {
        pageId: z.string().describe("Wiki Page ID"),
        title: z.string().min(1).max(200).optional().describe("New title"),
        content: z.string().optional().describe("New content"),
        parentId: z.string().optional().describe("New parent page ID"),
      },
    },
    async ({ pageId, title, content, parentId }) => {
      const page = await wikiSvc.updatePage(pageId, userId, {
        title,
        content,
        parentId,
      });
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(page, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "delete_wiki_page",
    {
      description: "Delete a wiki page",
      inputSchema: { pageId: z.string().describe("Wiki Page ID") },
    },
    async ({ pageId }) => {
      await wikiSvc.deletePage(pageId, userId);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify({ deleted: pageId }) },
        ],
      };
    },
  );

  server.registerTool(
    "get_wiki_history",
    {
      description: "Get the revision history of a wiki page",
      inputSchema: { pageId: z.string().describe("Wiki Page ID") },
    },
    async ({ pageId }) => {
      const history = await wikiSvc.getHistory(pageId);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(history, null, 2) },
        ],
      };
    },
  );

  server.registerTool(
    "search_wiki",
    {
      description: "Search for wiki pages by title in an organization",
      inputSchema: {
        orgId: z.string().describe("Organization ID"),
        query: z.string().describe("Search query"),
      },
    },
    async ({ orgId, query }) => {
      const results = await wikiSvc.searchPages(orgId, query);
      return {
        content: [
          { type: "text" as const, text: JSON.stringify(results, null, 2) },
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
