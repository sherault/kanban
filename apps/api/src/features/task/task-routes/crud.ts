import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { HonoEnv } from "../../../types.js";
import type { TaskService } from "../task.service.js";
import { createTaskSchema, updateTaskSchema } from "./schemas.js";
import { assertProjectTask } from "./guards.js";

export function registerTaskCrudRoutes(
  router: Hono<HonoEnv>,
  svc: TaskService,
) {
  router.get("/:projectId/tasks", (c) =>
    c.json(svc.listTasks(c.req.param("projectId"))),
  );

  router.post(
    "/:projectId/tasks",
    zValidator("json", createTaskSchema),
    (c) => {
      const task = svc.createTask(
        c.req.param("projectId"),
        c.get("userId"),
        c.req.valid("json"),
      );
      return c.json(task, 201);
    },
  );

  router.get("/:projectId/tasks/:taskId", (c) => {
    const task = assertProjectTask(
      svc,
      c.req.param("projectId"),
      c.req.param("taskId"),
    );
    return c.json(task);
  });

  router.patch(
    "/:projectId/tasks/:taskId",
    zValidator("json", updateTaskSchema),
    (c) => {
      assertProjectTask(svc, c.req.param("projectId"), c.req.param("taskId"));
      return c.json(
        svc.updateTask(
          c.req.param("taskId"),
          c.get("userId"),
          c.req.valid("json"),
        ),
      );
    },
  );

  router.delete("/:projectId/tasks/:taskId", (c) => {
    assertProjectTask(svc, c.req.param("projectId"), c.req.param("taskId"));
    svc.deleteTask(c.req.param("taskId"), c.get("userId"));
    return c.json({ success: true });
  });

  router.get("/:projectId/tasks/:taskId/history", (c) => {
    assertProjectTask(svc, c.req.param("projectId"), c.req.param("taskId"));
    return c.json(svc.getTaskHistory(c.req.param("taskId")));
  });
}
