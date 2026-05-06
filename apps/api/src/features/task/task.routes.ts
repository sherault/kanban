import { Hono } from "hono";
import type { AppDb, Broadcaster, HonoEnv } from "../../types.js";
import { noopBroadcaster } from "../../types.js";
import { authnMiddleware } from "../../middleware/authn.js";
import { makeProjectAuthz } from "../../middleware/project-member.js";
import { TaskService } from "./task.service.js";
import { makeAuthz } from "../../middleware/authz.js";
import { registerArchiveTaskRoutes } from "./task-routes/archive.js";
import { registerTaskCrudRoutes } from "./task-routes/crud.js";
import { registerGlobalTaskRoutes } from "./task-routes/global.js";
import { registerTaskMoveImportRoutes } from "./task-routes/move-import.js";
import { registerTaskParticipantRoutes } from "./task-routes/participants.js";
import { registerTaskRelationRoutes } from "./task-routes/relations.js";

export function taskRoutes(
  db: AppDb,
  broadcast: Broadcaster = noopBroadcaster,
): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>();
  const svc = new TaskService(db, broadcast);
  const projectAuthz = makeProjectAuthz(db);
  const orgAuthz = makeAuthz(db);

  router.use("*", authnMiddleware);
  registerGlobalTaskRoutes(router, svc, db, orgAuthz);
  router.use("/:projectId/*", projectAuthz.requireProjectMember());
  registerArchiveTaskRoutes(router, svc);
  registerTaskCrudRoutes(router, svc);
  registerTaskRelationRoutes(router, svc);
  registerTaskParticipantRoutes(router, svc);
  registerTaskMoveImportRoutes(router, svc);

  return router;
}
