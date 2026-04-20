import { Hono } from "hono";
import type { Context } from "hono";
import { randomUUID } from "node:crypto";
import type { HttpBindings } from "@hono/node-server";
import { StreamableHTTPTransport } from "@hono/mcp";
import type { AppDb, Broadcaster } from "../../types.js";
import { ApiKeyService } from "../api-key/api-key.service.js";
import { createMcpServer } from "./mcp.server.js";
import { unauthorized } from "../../lib/errors.js";
import { logger } from "../../lib/logger.js";

type NodeEnv = { Bindings: HttpBindings };

/** Streamable HTTP sessions: sessionId → transport */
const httpSessions = new Map<string, StreamableHTTPTransport>();

export function mcpRoutes(db: AppDb, broadcast: Broadcaster): Hono<NodeEnv> {
  const app = new Hono<NodeEnv>();
  const apiKeySvc = new ApiKeyService(db);

  async function resolveApiKey(
    authHeader: string | undefined,
  ): Promise<string> {
    if (!authHeader?.startsWith("Bearer ")) throw unauthorized();
    const rawKey = authHeader.slice(7);
    const userId = await apiKeySvc.resolveKey(rawKey);
    if (!userId) throw unauthorized();
    return userId;
  }

  /**
   * Surgical fix for Hono Node.js adapter (V3):
   * Inspects the raw response state to prevent ERR_HTTP_HEADERS_SENT.
   */
  async function finalize(
    c: Context<NodeEnv>,
    response: Response,
  ): Promise<Response> {
    const nodeRes = c.env?.outgoing;
    const headersSent = nodeRes?.headersSent ?? false;

    logger.info(
      `[MCP V3] Finalizing ${c.req.path}. headersSent=${headersSent}`,
    );

    if (headersSent) {
      logger.info(
        `[MCP V3] Bypassing Hono finalizer for ${c.req.path} because headers were already sent.`,
      );
      return new Response(null);
    }

    return response;
  }

  app.post("/", async (c) => {
    logger.info(`[MCP V3] POST ${c.req.path} received`);
    const sessionId = c.req.header("mcp-session-id");

    if (sessionId) {
      const transport = httpSessions.get(sessionId);
      if (!transport) {
        logger.warn(`[MCP V3] session not found: ${sessionId}`);
        return c.json({ error: "Session not found" }, 404);
      }
      const response = await transport.handleRequest(c);
      if (!response)
        return c.json({ error: "No response from transport" }, 500);
      return await finalize(c, response);
    } else {
      const userId = await resolveApiKey(c.req.header("authorization"));
      logger.info(`[MCP V3] new session user ${userId}`);

      const transport = new StreamableHTTPTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          logger.info(`[MCP V3] session closed: ${transport.sessionId}`);
          httpSessions.delete(transport.sessionId);
        }
      };

      const server = createMcpServer(userId, db, broadcast);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await server.connect(transport as any);

      const response = await transport.handleRequest(c);
      if (!response)
        return c.json({ error: "No response from transport" }, 500);

      if (transport.sessionId) {
        httpSessions.set(transport.sessionId, transport);
        logger.info(`[MCP V3] session created: ${transport.sessionId}`);
      }

      return await finalize(c, response);
    }
  });

  app.get("/", async (c) => {
    const sessionId = c.req.header("mcp-session-id");
    if (!sessionId)
      return c.json({ error: "Missing Mcp-Session-Id header" }, 400);

    const transport = httpSessions.get(sessionId);
    if (!transport) {
      logger.warn(`[MCP V3] GET session not found: ${sessionId}`);
      return c.json({ error: "Session not found" }, 404);
    }

    logger.info(`[MCP V3] GET SSE session ${sessionId}`);
    const response = await transport.handleRequest(c);
    if (!response) return c.json({ error: "No response from transport" }, 500);

    return await finalize(c, response);
  });

  app.delete("/", async (c) => {
    const sessionId = c.req.header("mcp-session-id");
    if (!sessionId)
      return c.json({ error: "Missing Mcp-Session-Id header" }, 400);

    const transport = httpSessions.get(sessionId);
    if (!transport) return c.json({ error: "Session not found" }, 404);

    logger.info(`[MCP V3] DELETE session ${sessionId}`);
    const response = await transport.handleRequest(c);
    if (!response) return c.json({ error: "No response from transport" }, 500);

    return await finalize(c, response);
  });

  return app;
}
