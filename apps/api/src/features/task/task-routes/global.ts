import type { Hono } from "hono";
import { and, eq } from "drizzle-orm";
import type { AppDb, HonoEnv } from "../../../types.js";
import type { makeAuthz } from "../../../middleware/authz.js";
import { forbidden, notFound } from "../../../lib/errors.js";
import { memberships, projects } from "../../../db/schema/index.js";
import type { TaskService } from "../task.service.js";

export function registerGlobalTaskRoutes(
  router: Hono<HonoEnv>,
  svc: TaskService,
  db: AppDb,
  orgAuthz: ReturnType<typeof makeAuthz>,
) {
  router.get(
    "/search/:orgId",
    orgAuthz.requireOrgRole("member", (c) => c.req.param("orgId")),
    (c) => {
      const query = c.req.query("q") ?? "";
      if (query.length < 2) return c.json([]);
      return c.json(svc.searchTasksInOrg(c.req.param("orgId"), query));
    },
  );

  router.get("/by-id/:taskId", async (c) => {
    const userId = c.get("userId");
    const task = svc.getTaskGlobal(c.req.param("taskId"));
    if (!task) throw notFound("Task not found");

    const project = db
      .select({ organizationId: projects.organizationId })
      .from(projects)
      .where(eq(projects.id, task.projectId))
      .get();
    if (!project) throw notFound("Task project not found");

    const membership = db
      .select()
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, project.organizationId),
        ),
      )
      .get();
    if (!membership) throw forbidden();

    return c.json(task);
  });
}
