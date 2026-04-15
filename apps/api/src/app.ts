import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { HTTPException } from "hono/http-exception";
import type { AppDb, Broadcaster, HonoEnv } from "./types.js";
import { noopBroadcaster } from "./types.js";
import { identityRoutes } from "./features/identity/identity.routes.js";
import { organizationRoutes } from "./features/organization/organization.routes.js";
import { invitationRoutes } from "./features/invitation/invitation.routes.js";
import { apiKeyRoutes } from "./features/api-key/api-key.routes.js";
import { projectRoutes } from "./features/project/project.routes.js";
import { taskRoutes } from "./features/task/task.routes.js";
import { mcpRoutes } from "./features/mcp/mcp.routes.js";

export function createApp(
  db: AppDb,
  broadcast: Broadcaster = noopBroadcaster,
): Hono<HonoEnv> {
  const app = new Hono<HonoEnv>();

  const frontendUrl = process.env["APP_URL"] ?? "http://localhost:3009";
  const isProd = process.env["NODE_ENV"] === "production";
  const isTest = process.env["NODE_ENV"] === "test";
  const hstsEnabled =
    process.env["ENABLE_HSTS"] === "true" ||
    (isProd && process.env["ENABLE_HSTS"] !== "false");

  app.use(
    "*",
    secureHeaders({
      strictTransportSecurity: hstsEnabled
        ? "max-age=31536000; includeSubDomains; preload"
        : false,
    }),
  );
  app.use(
    "*",
    cors({
      origin: frontendUrl,
      credentials: true,
    }),
  );
  if (!isTest) {
    app.use("*", async (c, next) => {
      const origin = c.req.header("Origin");
      if (
        c.req.method !== "GET" &&
        c.req.method !== "HEAD" &&
        origin !== frontendUrl
      ) {
        console.error(
          `[CSRF] Rejected request from origin: "${origin}" (expected: "${frontendUrl}") for ${c.req.method} ${c.req.path}`,
        );
      }
      await next();
    });
    app.use(
      "*",
      csrf({
        origin: frontendUrl,
      }),
    );
  }

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    console.error(err);
    return c.json({ error: "Internal server error" }, 500);
  });

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.route("/auth", identityRoutes(db));
  app.route("/organizations", organizationRoutes(db, broadcast));
  app.route("/organizations", projectRoutes(db, broadcast));
  app.route("/projects", taskRoutes(db, broadcast));
  app.route("/invite", invitationRoutes(db));
  app.route("/profile", apiKeyRoutes(db));
  app.route("/mcp", mcpRoutes(db, broadcast));

  return app;
}
