import { serve } from '@hono/node-server'
import { runMigrations } from './db/migrate.js'
import { app } from './app.js'

runMigrations()

const port = Number(process.env['PORT'] ?? 3001)

serve({ fetch: app.fetch, port }, () => {
  console.log(`API running on http://localhost:${port}`)
})
