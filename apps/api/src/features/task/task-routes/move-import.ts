import type { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { HonoEnv } from "../../../types.js";
import { unprocessable } from "../../../lib/errors.js";
import type { TaskService } from "../task.service.js";
import { assertProjectTask } from "./guards.js";
import { moveSchema } from "./schemas.js";

export function registerTaskMoveImportRoutes(
  router: Hono<HonoEnv>,
  svc: TaskService,
) {
  router.post(
    "/:projectId/tasks/:taskId/move",
    zValidator("json", moveSchema),
    (c) => {
      assertProjectTask(svc, c.req.param("projectId"), c.req.param("taskId"));
      const { column } = c.req.valid("json");
      return c.json(
        svc.moveTask(c.req.param("taskId"), c.get("userId"), { column }),
      );
    },
  );

  router.post("/:projectId/import", async (c) => {
    const body = await c.req.parseBody();
    const file = body["file"];
    if (!(file instanceof File)) throw unprocessable("file field required");
    const result = svc.importTasks(
      c.req.param("projectId"),
      c.get("userId"),
      await file.text(),
    );
    return c.json(result, 201);
  });
}
