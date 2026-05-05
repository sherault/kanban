import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppDb, Broadcaster, HonoEnv } from "../../types.js";
import { WikiService } from "./wiki.service.js";
import { authnMiddleware } from "../../middleware/authn.js";
import { noopBroadcaster } from "../../types.js";

const createPageSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string(),
  parentId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  properties: z.any().optional(),
});

const updatePageSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  content: z.string().optional(),
  parentId: z.string().nullable().optional(),
  properties: z.any().optional(),
});

export function wikiRoutes(
  db: AppDb,
  broadcast: Broadcaster = noopBroadcaster,
) {
  const app = new Hono<HonoEnv>();
  const wikiSvc = new WikiService(db, broadcast);

  app.use("/organizations/:orgId/wiki/*", authnMiddleware);
  app.use("/wiki/*", authnMiddleware);

  // List pages for an organization
  app.get("/organizations/:orgId/wiki/pages", async (c) => {
    const orgId = c.req.param("orgId");
    const userId = c.get("userId");
    const pages = await wikiSvc.listPages(orgId, userId);
    return c.json(pages);
  });

  // Create a new page
  app.post(
    "/organizations/:orgId/wiki/pages",
    zValidator("json", createPageSchema),
    async (c) => {
      const orgId = c.req.param("orgId");
      const userId = c.get("userId");
      const data = c.req.valid("json");
      const page = await wikiSvc.createPage(orgId, userId, data);
      return c.json(page, 201);
    },
  );

  // Get a single page
  app.get("/wiki/pages/:pageId", async (c) => {
    const pageId = c.req.param("pageId");
    try {
      const page = await wikiSvc.getPage(pageId);
      if (!page) return c.json({ error: "Page not found" }, 404);
      return c.json(page);
    } catch (err) {
      console.error(`[WikiRoutes] Error fetching page ${pageId}:`, err);
      throw err; // Let global handler handle it, but now we have the log
    }
  });

  // Update a page
  app.patch(
    "/wiki/pages/:pageId",
    zValidator("json", updatePageSchema),
    async (c) => {
      const pageId = c.req.param("pageId");
      const userId = c.get("userId");
      const data = c.req.valid("json");
      const page = await wikiSvc.updatePage(pageId, userId, data);
      return c.json(page);
    },
  );

  // Delete a page
  app.delete("/wiki/pages/:pageId", async (c) => {
    const pageId = c.req.param("pageId");
    const userId = c.get("userId");
    await wikiSvc.deletePage(pageId, userId);
    return c.json({ deleted: pageId });
  });

  // Get page history
  app.get("/wiki/pages/:pageId/history", async (c) => {
    const pageId = c.req.param("pageId");
    const history = await wikiSvc.getHistory(pageId);
    return c.json(history);
  });

  return app;
}
