import { serve } from '@hono/node-server'
import { createNodeWebSocket } from '@hono/node-ws'
import { db } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { createApp } from './app.js'
import { WsRooms } from './features/ws/ws-rooms.js'
import { wsRoutes } from './features/ws/ws.routes.js'

runMigrations()

const wsRooms = new WsRooms()
const broadcast = wsRooms.broadcast.bind(wsRooms)
const app = createApp(db, broadcast)

const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app })
app.route('/ws', wsRoutes(db, wsRooms, upgradeWebSocket))

const port = Number(process.env['PORT'] ?? 3001)
const server = serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`)
})
injectWebSocket(server)
