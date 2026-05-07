import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { AppDb, Broadcaster, HonoEnv } from "../../types.js";
import { noopBroadcaster } from "../../types.js";
import { authnMiddleware } from "../../middleware/authn.js";
import { makeAuthz } from "../../middleware/authz.js";
import { ProjectService } from "./project.service.js";
import { notFound } from "../../lib/errors.js";

const createProjectSchema = z.object({ name: z.string().min(1).max(200) });
const updateProjectSchema = z.object({ name: z.string().min(1).max(200) });

export function projectRoutes(
  db: AppDb,
  broadcast: Broadcaster = noopBroadcaster,
): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>();
  const svc = new ProjectService(db, broadcast);
  const authz = makeAuthz(db);

  router.use("*", authnMiddleware);

  router.get(
    "/:orgId/projects",
    authz.requireOrgRole("member", (c) => c.req.param("orgId")),
    (c) => c.json(svc.listProjects(c.req.param("orgId"))),
  );

  router.post(
    "/:orgId/projects",
    authz.requireOrgRole("member", (c) => c.req.param("orgId")),
    zValidator("json", createProjectSchema),
    (c) => {
      const project = svc.createProject(
        c.req.param("orgId"),
        c.req.valid("json"),
        c.get("userId"),
      );
      return c.json(project, 201);
    },
  );

  router.get(
    "/:orgId/projects/:projectId",
    authz.requireOrgRole("member", (c) => c.req.param("orgId")),
    (c) => {
      const project = svc.getProject(c.req.param("projectId"));
      if (!project) throw notFound("Project not found");
      return c.json(project);
    },
  );

  router.patch(
    "/:orgId/projects/:projectId",
    authz.requireOrgRole("manager", (c) => c.req.param("orgId")),
    zValidator("json", updateProjectSchema),
    (c) => {
      const project = svc.updateProject(
        c.req.param("orgId"),
        c.req.param("projectId"),
        c.req.valid("json"),
      );
      return c.json(project);
    },
  );

  router.delete(
    "/:orgId/projects/:projectId",
    authz.requireOrgRole("manager", (c) => c.req.param("orgId")),
    (c) => {
      svc.deleteProject(
        c.req.param("orgId"),
        c.req.param("projectId"),
        c.get("userId"),
      );
      return c.json({ success: true });
    },
  );

  return router;
}
