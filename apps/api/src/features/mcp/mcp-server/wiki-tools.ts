import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { WikiService } from "../../wiki/wiki.service.js";
import { jsonText, textResult } from "./utils.js";

const KANBAN_LINK_GUIDANCE =
  "Kanban supports durable Markdown interlinks. Use [label](wiki://<WIKI_PAGE_UUID>) for wiki pages and [label](task://<TASK_UUID>) for tasks. Do not invent UUIDs: search or fetch the target first, then use its id.";

const WIKI_PROPERTIES_GUIDANCE =
  "Wiki page properties are frontmatter-like structured metadata. Put machine-readable details such as doc_type, jurisdiction, validation_status, source_urls, freshness, cite_required, and related wiki:// or task:// ids in properties. Put human-readable prose in content.";

export function registerWikiTools(
  server: McpServer,
  wikiSvc: WikiService,
  userId: string,
) {
  server.registerTool(
    "list_wiki_pages",
    {
      description: `List all wiki pages in an organization. Returns page ids, titles, hierarchy, project mapping, and metadata properties. ${KANBAN_LINK_GUIDANCE} ${WIKI_PROPERTIES_GUIDANCE}`,
      inputSchema: { orgId: z.string().describe("Organization ID") },
    },
    async ({ orgId }) => jsonText(await wikiSvc.listPages(orgId)),
  );

  server.registerTool(
    "get_wiki_page",
    {
      description: `Get the full Markdown content and metadata properties of a wiki page. ${KANBAN_LINK_GUIDANCE} ${WIKI_PROPERTIES_GUIDANCE}`,
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
      description: `Create a new wiki page with Markdown content and optional metadata properties. ${KANBAN_LINK_GUIDANCE} ${WIKI_PROPERTIES_GUIDANCE}`,
      inputSchema: {
        orgId: z.string().describe("Organization ID"),
        title: z.string().min(1).max(200).describe("Page title"),
        content: z
          .string()
          .describe(
            "Page content as human-readable Markdown. Use wiki:// and task:// Markdown links for durable references.",
          ),
        parentId: z.string().optional().describe("Optional parent page ID"),
        projectId: z
          .string()
          .optional()
          .describe("Optional project ID mapping"),
        properties: z
          .record(z.string(), z.any())
          .nullable()
          .optional()
          .describe(
            "Optional frontmatter-like metadata properties such as doc_type, validation_status, source_urls, freshness, and related ids",
          ),
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
      description: `Update an existing wiki page (title, content, parent, or metadata properties). ${KANBAN_LINK_GUIDANCE} ${WIKI_PROPERTIES_GUIDANCE}`,
      inputSchema: {
        pageId: z.string().describe("Wiki Page ID"),
        title: z.string().min(1).max(200).optional().describe("New title"),
        content: z
          .string()
          .optional()
          .describe(
            "New human-readable Markdown content. Use wiki:// and task:// Markdown links for durable references.",
          ),
        parentId: z.string().optional().describe("New parent page ID"),
        properties: z
          .record(z.string(), z.any())
          .nullable()
          .optional()
          .describe("New frontmatter-like metadata properties"),
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
    "set_wiki_page_property",
    {
      description: `Set a single metadata property on a wiki page without rewriting the whole page. ${WIKI_PROPERTIES_GUIDANCE}`,
      inputSchema: {
        pageId: z.string().describe("Wiki Page ID"),
        key: z.string().describe("Property key"),
        value: z.any().describe("Property value (null to delete)"),
      },
    },
    async ({ pageId, key, value }) => {
      const page = await wikiSvc.getPage(pageId);
      if (!page) return textResult("Wiki page not found", true);

      const properties = { ...(page.properties || {}) };
      if (value === null) {
        delete properties[key];
      } else {
        properties[key] = value;
      }

      return jsonText(
        await wikiSvc.updatePage(pageId, userId, {
          properties,
        }),
      );
    },
  );

  server.registerTool(
    "search_wiki",
    {
      description: `Search for wiki pages by title in an organization. Use this before creating wiki:// links so you can link to real page ids.`,
      inputSchema: {
        orgId: z.string().describe("Organization ID"),
        query: z.string().describe("Search query"),
      },
    },
    async ({ orgId, query }) =>
      jsonText(await wikiSvc.searchPages(orgId, query)),
  );
}
