import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import type { HttpBindings } from "@hono/node-server";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import type { AppDb, Broadcaster } from "../../types.js";
import { ApiKeyService } from "../api-key/api-key.service.js";
import { createMcpServer } from "./mcp.server.js";
import { unauthorized } from "../../lib/errors.js";

type NodeEnv = { Bindings: HttpBindings };

// ── Session stores ─────────────────────────────────────────────────────────

/** Legacy SSE sessions: sessionId → transport */
const sseSessions = new Map<string, SSEServerTransport>();

/** Streamable HTTP sessions: sessionId → transport */
const httpSessions = new Map<string, StreamableHTTPServerTransport>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mcpRoutes(db: AppDb, broadcast: Broadcaster): Hono<any> {
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

  // ── Streamable HTTP transport (modern — MCP spec 2025-03-26) ─────────────
  //
  // Single endpoint handles GET (SSE notifications) and POST (messages).
  // Session negotiated via Mcp-Session-Id header.
  // DELETE terminates a session.

  app.post("/", async (c) => {
    const nodeReq = c.env.incoming;
    const nodeRes = c.env.outgoing;

    const sessionId = nodeReq.headers["mcp-session-id"] as string | undefined;

    if (sessionId) {
      // Existing session
      const transport = httpSessions.get(sessionId);
      if (!transport) {
        console.warn(`[MCP] POST / — session not found: ${sessionId}`);
        return c.json({ error: "Session not found" }, 404);
      }
      console.log(`[MCP] POST / — session ${sessionId}`);
      await transport.handleRequest(nodeReq, nodeRes);
    } else {
      // New session — authenticate and create transport
      const userId = await resolveApiKey(nodeReq.headers["authorization"]);
      console.log(`[MCP] POST / — new session for user ${userId}`);

      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });

      transport.onclose = () => {
        if (transport.sessionId) {
          console.log(`[MCP] session closed: ${transport.sessionId}`);
          httpSessions.delete(transport.sessionId);
        }
      };

      const server = createMcpServer(userId, db, broadcast);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await server.connect(transport as any);
      await transport.handleRequest(nodeReq, nodeRes);

      if (transport.sessionId) {
        httpSessions.set(transport.sessionId, transport);
        console.log(`[MCP] session created: ${transport.sessionId}`);
      }
    }

    return new Response(null, { status: 200 });
  });

  app.get("/", async (c) => {
    const nodeReq = c.env.incoming;
    const nodeRes = c.env.outgoing;

    const sessionId = nodeReq.headers["mcp-session-id"] as string | undefined;
    if (!sessionId)
      return c.json({ error: "Missing Mcp-Session-Id header" }, 400);

    const transport = httpSessions.get(sessionId);
    if (!transport) {
      console.warn(`[MCP] GET / — session not found: ${sessionId}`);
      return c.json({ error: "Session not found" }, 404);
    }

    console.log(`[MCP] GET / SSE — session ${sessionId}`);
    await transport.handleRequest(nodeReq, nodeRes);
    return new Response(null, { status: 200 });
  });

  app.delete("/", async (c) => {
    const nodeReq = c.env.incoming;
    const nodeRes = c.env.outgoing;

    const sessionId = nodeReq.headers["mcp-session-id"] as string | undefined;
    if (!sessionId)
      return c.json({ error: "Missing Mcp-Session-Id header" }, 400);

    const transport = httpSessions.get(sessionId);
    if (!transport) return c.json({ error: "Session not found" }, 404);

    console.log(`[MCP] DELETE / — closing session ${sessionId}`);
    await transport.handleRequest(nodeReq, nodeRes);
    return new Response(null, { status: 200 });
  });

  // ── Legacy SSE transport (for older clients) ─────────────────────────────
  //
  // GET /mcp/sse   → establishes SSE stream
  // POST /mcp/message?sessionId=xxx → back-channel messages

  app.get("/sse", async (c) => {
    const userId = await resolveApiKey(c.req.header("Authorization"));
    console.log(`[MCP] GET /sse — user ${userId}`);

    const nodeRes = c.env.outgoing;
    const transport = new SSEServerTransport("/mcp/message", nodeRes);
    sseSessions.set(transport.sessionId, transport);

    nodeRes.on("close", () => {
      console.log(`[MCP] SSE closed — session ${transport.sessionId}`);
      sseSessions.delete(transport.sessionId);
      void transport.close();
    });

    const server = createMcpServer(userId, db, broadcast);
    await server.connect(transport);

    return new Response(null, { status: 200 });
  });

  app.post("/message", async (c) => {
    const sessionId = c.req.query("sessionId");
    if (!sessionId) return c.json({ error: "Missing sessionId" }, 400);

    const transport = sseSessions.get(sessionId);
    if (!transport) {
      console.warn(`[MCP] POST /message — session not found: ${sessionId}`);
      return c.json({ error: "Session not found" }, 404);
    }

    console.log(`[MCP] POST /message — session ${sessionId}`);
    const nodeReq = c.env.incoming;
    const nodeRes = c.env.outgoing;
    await transport.handlePostMessage(nodeReq, nodeRes);

    return new Response(null, { status: 200 });
  });

  return app;
}
