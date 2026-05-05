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
import { wikiRoutes } from "./features/wiki/wiki.routes.js";
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

  // ── Global Middlewares ──────────────────────────────────────────────────

  // Skip browser-security middlewares for MCP routes
  app.use("/mcp/*", async (c, next) => {
    return await next();
  });

  // Apply Security Headers
  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/mcp")) return await next();
    return await secureHeaders({
      strictTransportSecurity: hstsEnabled
        ? "max-age=31536000; includeSubDomains; preload"
        : false,
    })(c, next);
  });

  // Apply CORS
  app.use("*", async (c, next) => {
    if (c.req.path.startsWith("/mcp")) return await next();
    return await cors({
      origin: frontendUrl,
      credentials: true,
    })(c, next);
  });

  // Apply CSRF (non-test only)
  if (!isTest) {
    app.use("*", async (c, next) => {
      if (c.req.path.startsWith("/mcp")) return await next();
      return await csrf({
        origin: frontendUrl,
      })(c, next);
    });
  }

  // CSRF logging middleware
  if (!isTest) {
    app.use("*", async (c, next) => {
      if (c.req.path.startsWith("/mcp")) return await next();

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
      return await next();
    });
  }

  app.onError((err, c) => {
    console.error(`[API Error] ${c.req.method} ${c.req.path}:`, err);
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status);
    }
    return c.json({ error: "Internal server error" }, 500);
  });

  app.use("*", async (c, next) => {
    await next();
    if (!c.res) {
      console.warn(
        `[API Warning] Context NOT finalized for ${c.req.method} ${c.req.path}`,
      );
    }
  });

  app.get("/health", (c) => c.json({ status: "ok" }));
  app.route("/auth", identityRoutes(db));
  app.route("/organizations", organizationRoutes(db, broadcast));
  app.route("/organizations", projectRoutes(db, broadcast));
  app.route("/projects", taskRoutes(db, broadcast));
  app.route("/", wikiRoutes(db, broadcast));
  app.route("/invite", invitationRoutes(db));
  app.route("/profile", apiKeyRoutes(db));
  app.route("/mcp", mcpRoutes(db, broadcast));

  return app;
}
