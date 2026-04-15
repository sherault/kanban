import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { UpgradeWebSocket } from "hono/ws";
import type { AppDb, HonoEnv } from "../../types.js";
import type { WsRooms } from "./ws-rooms.js";
import { verifyAccessToken } from "../../lib/jwt.js";
import { memberships, projects } from "../../db/schema/index.js";

export function wsRoutes(
  db: AppDb,
  wsRooms: WsRooms,
  upgradeWebSocket: UpgradeWebSocket,
): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>();

  router.get(
    "/",
    upgradeWebSocket((c) => {
      // Closure-per-connection: captures userId once auth succeeds
      let userId: string | undefined;

      return {
        async onOpen(_event, ws) {
          const token = c.req.query("token");
          if (!token) {
            ws.close(1008, "Missing token");
            return;
          }
          try {
            const payload = await verifyAccessToken(token);
            userId = payload.sub;
          } catch {
            ws.close(1008, "Invalid token");
            return;
          }

          // Auto-subscribe to all org rooms the user belongs to
          const userOrgs = db
            .select({ organizationId: memberships.organizationId })
            .from(memberships)
            .where(eq(memberships.userId, userId))
            .all();

          for (const { organizationId } of userOrgs) {
            wsRooms.subscribe(`org:${organizationId}`, ws);
          }
        },

        onMessage(event, ws) {
          if (!userId) return;
          try {
            const msg = JSON.parse(event.data.toString()) as {
              type?: string;
              room?: string;
            };
            if (
              msg.type === "subscribe" &&
              typeof msg.room === "string" &&
              msg.room.startsWith("project:")
            ) {
              const projectId = msg.room.slice("project:".length);
              const project = db
                .select({ organizationId: projects.organizationId })
                .from(projects)
                .where(eq(projects.id, projectId))
                .get();
              if (!project) return;
              const mem = db
                .select({ role: memberships.role })
                .from(memberships)
                .where(
                  and(
                    eq(memberships.userId, userId),
                    eq(memberships.organizationId, project.organizationId),
                  ),
                )
                .get();
              if (mem) wsRooms.subscribe(`project:${projectId}`, ws);
            }
          } catch {
            // ignore malformed messages
          }
        },

        onClose(_event, ws) {
          wsRooms.unsubscribe(ws);
        },
      };
    }),
  );

  return router;
}
