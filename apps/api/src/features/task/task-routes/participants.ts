import type { Hono } from "hono";
import type { HonoEnv } from "../../../types.js";
import type { TaskService } from "../task.service.js";
import { assertProjectTask } from "./guards.js";

export function registerTaskParticipantRoutes(
  router: Hono<HonoEnv>,
  svc: TaskService,
) {
  router.post("/:projectId/tasks/:taskId/watchers/:userId", (c) => {
    assertProjectTask(svc, c.req.param("projectId"), c.req.param("taskId"));
    return c.json(
      svc.addWatcher(
        c.req.param("taskId"),
        c.req.param("userId"),
        c.get("userId"),
      ),
    );
  });

  router.delete("/:projectId/tasks/:taskId/watchers/:userId", (c) => {
    assertProjectTask(svc, c.req.param("projectId"), c.req.param("taskId"));
    return c.json(
      svc.removeWatcher(
        c.req.param("taskId"),
        c.req.param("userId"),
        c.get("userId"),
      ),
    );
  });

  router.post("/:projectId/tasks/:taskId/advisors/:userId", (c) => {
    assertProjectTask(svc, c.req.param("projectId"), c.req.param("taskId"));
    return c.json(
      svc.addAdvisor(
        c.req.param("taskId"),
        c.req.param("userId"),
        c.get("userId"),
      ),
    );
  });

  router.delete("/:projectId/tasks/:taskId/advisors/:userId", (c) => {
    assertProjectTask(svc, c.req.param("projectId"), c.req.param("taskId"));
    return c.json(
      svc.removeAdvisor(
        c.req.param("taskId"),
        c.req.param("userId"),
        c.get("userId"),
      ),
    );
  });
}
