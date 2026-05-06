import type { Hono } from "hono";
import type { HonoEnv } from "../../../types.js";
import type { TaskService } from "../task.service.js";
import { assertProjectTask } from "./guards.js";

export function registerTaskRelationRoutes(
  router: Hono<HonoEnv>,
  svc: TaskService,
) {
  router.post("/:projectId/tasks/:taskId/tags/:tag", (c) => {
    assertProjectTask(svc, c.req.param("projectId"), c.req.param("taskId"));
    return c.json(
      svc.addTag(c.req.param("taskId"), c.req.param("tag"), c.get("userId")),
    );
  });

  router.delete("/:projectId/tasks/:taskId/tags/:tag", (c) => {
    assertProjectTask(svc, c.req.param("projectId"), c.req.param("taskId"));
    return c.json(
      svc.removeTag(c.req.param("taskId"), c.req.param("tag"), c.get("userId")),
    );
  });

  router.post("/:projectId/tasks/:taskId/links/:linkedTaskId", (c) =>
    c.json(
      svc.addLink(
        c.req.param("taskId"),
        c.req.param("linkedTaskId"),
        c.get("userId"),
      ),
    ),
  );

  router.delete("/:projectId/tasks/:taskId/links/:linkedTaskId", (c) => {
    assertProjectTask(svc, c.req.param("projectId"), c.req.param("taskId"));
    return c.json(
      svc.removeLink(
        c.req.param("taskId"),
        c.req.param("linkedTaskId"),
        c.get("userId"),
      ),
    );
  });
}
