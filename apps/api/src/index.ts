import { serve } from '@hono/node-server'
import { db } from './db/client.js'
import { runMigrations } from './db/migrate.js'
import { createApp } from './app.js'

runMigrations()
const app = createApp(db)

const port = Number(process.env['PORT'] ?? 3001)
serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`)
})
