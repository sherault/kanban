import { Hono } from 'hono'
import type { HttpBindings } from '@hono/node-server'
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js'
import type { AppDb, Broadcaster } from '../../types.js'
import { ApiKeyService } from '../api-key/api-key.service.js'
import { createMcpServer } from './mcp.server.js'
import { unauthorized } from '../../lib/errors.js'

type NodeEnv = { Bindings: HttpBindings }

/** Maps sessionId → active SSE transport for POST back-channel routing. */
const transports = new Map<string, SSEServerTransport>()

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function mcpRoutes(db: AppDb, broadcast: Broadcaster): Hono<any> {
  const app = new Hono<NodeEnv>()
  const apiKeySvc = new ApiKeyService(db)

  /**
   * Resolve a Bearer API key from the Authorization header.
   * Returns the userId on success, throws 401 on failure.
   */
  async function resolveApiKey(authHeader: string | undefined): Promise<string> {
    if (!authHeader?.startsWith('Bearer ')) throw unauthorized()
    const rawKey = authHeader.slice(7)
    const userId = await apiKeySvc.resolveKey(rawKey)
    if (!userId) throw unauthorized()
    return userId
  }

  /**
   * GET /mcp/sse
   *
   * Establishes the SSE stream. The MCP SDK writes frames directly to the
   * raw Node.js ServerResponse and keeps it open for the session lifetime.
   */
  app.get('/sse', async (c) => {
    const userId = await resolveApiKey(c.req.header('Authorization'))

    // Access raw Node.js response via @hono/node-server adapter
    const nodeRes = c.env.outgoing

    const transport = new SSEServerTransport('/mcp/message', nodeRes)
    transports.set(transport.sessionId, transport)

    nodeRes.on('close', () => {
      transports.delete(transport.sessionId)
      void transport.close()
    })

    const server = createMcpServer(userId, db, broadcast)
    await server.connect(transport)

    // The SSEServerTransport has taken over nodeRes — headers are already sent.
    // Return an empty response so Hono doesn't conflict.
    return new Response(null, { status: 200 })
  })

  /**
   * POST /mcp/message
   *
   * Back-channel for client → server messages. The sessionId query param
   * routes the message to the correct active transport.
   */
  app.post('/message', async (c) => {
    const sessionId = c.req.query('sessionId')
    if (!sessionId) {
      return c.json({ error: 'Missing sessionId' }, 400)
    }

    const transport = transports.get(sessionId)
    if (!transport) {
      return c.json({ error: 'Session not found' }, 404)
    }

    const nodeReq = c.env.incoming
    const nodeRes = c.env.outgoing

    await transport.handlePostMessage(nodeReq, nodeRes)

    // handlePostMessage writes directly to nodeRes — return empty to avoid conflict
    return new Response(null, { status: 200 })
  })

  return app
}
