import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WikiService } from "../../wiki/wiki.service.js";
import { jsonText, textResult } from "./utils.js";

export function registerWikiTools(
  server: McpServer,
  wikiSvc: WikiService,
  userId: string,
) {
  server.registerTool(
    "list_wiki_pages",
    {
      description: "List all wiki pages in an organization",
      inputSchema: { orgId: z.string().describe("Organization ID") },
    },
    async ({ orgId }) => jsonText(await wikiSvc.listPages(orgId)),
  );

  server.registerTool(
    "get_wiki_page",
    {
      description: "Get the full content of a wiki page",
      inputSchema: { pageId: z.string().describe("Wiki Page ID") },
    },
    async ({ pageId }) => {
      const page = await wikiSvc.getPage(pageId);
      return page ? jsonText(page) : textResult("Wiki page not found", true);
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
        properties: z
          .record(z.string(), z.any())
          .nullable()
          .optional()
          .describe("Optional page metadata properties (key-value)"),
      },
    },
    async ({ orgId, title, content, parentId, projectId, properties }) =>
      jsonText(
        await wikiSvc.createPage(orgId, userId, {
          title,
          content,
          parentId,
          projectId,
          properties: properties ?? null,
        }),
      ),
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
        properties: z
          .record(z.string(), z.any())
          .nullable()
          .optional()
          .describe("New page metadata properties"),
      },
    },
    async ({ pageId, title, content, parentId, properties }) =>
      jsonText(
        await wikiSvc.updatePage(pageId, userId, {
          title,
          content,
          parentId,
          properties: properties ?? null,
        }),
      ),
  );

  server.registerTool(
    "delete_wiki_page",
    {
      description: "Delete a wiki page",
      inputSchema: { pageId: z.string().describe("Wiki Page ID") },
    },
    async ({ pageId }) => {
      await wikiSvc.deletePage(pageId, userId);
      return jsonText({ deleted: pageId });
    },
  );

  server.registerTool(
    "get_wiki_history",
    {
      description: "Get the revision history of a wiki page",
      inputSchema: { pageId: z.string().describe("Wiki Page ID") },
    },
    async ({ pageId }) => jsonText(await wikiSvc.getHistory(pageId)),
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
    async ({ orgId, query }) =>
      jsonText(await wikiSvc.searchPages(orgId, query)),
  );
}
