import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { HonoEnv } from "../../../types.js";
import type { TaskService } from "../task.service.js";

export function registerArchiveTaskRoutes(
  router: Hono<HonoEnv>,
  svc: TaskService,
) {
  router.post(
    "/:projectId/tasks/archive",
    zValidator("json", z.object({ taskIds: z.array(z.string()).min(1) })),
    (c) => {
      svc.archiveTasks(
        c.req.param("projectId"),
        c.req.valid("json").taskIds,
        c.get("userId"),
      );
      return c.json({ success: true });
    },
  );

  router.get("/:projectId/archived-tasks", (c) => {
    const searchRaw = c.req.query("search");
    const dateFrom = c.req.query("dateFrom");
    const dateTo = c.req.query("dateTo");
    const opts = {
      page: parseInt(c.req.query("page") ?? "1", 10),
      limit: parseInt(c.req.query("limit") ?? "20", 10),
      ...(searchRaw !== undefined ? { search: searchRaw } : {}),
      ...(dateFrom ? { dateFrom } : {}),
      ...(dateTo ? { dateTo } : {}),
    };
    return c.json(svc.listArchivedTasks(c.req.param("projectId"), opts));
  });

  router.post("/:projectId/tasks/:taskId/restore", (c) => {
    const task = svc.restoreTask(c.req.param("taskId"), c.get("userId"));
    return c.json(task);
  });
}
