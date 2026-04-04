import { Hono } from 'hono'
import { HTTPException } from 'hono/http-exception'
import type { AppDb, HonoEnv } from './types.js'

export function createApp(db: AppDb): Hono<HonoEnv> {
  // db is used by route factories registered below.
  // TypeScript won't complain about it being "unused" once routes are added in later tasks.
  void db

  const app = new Hono<HonoEnv>()

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return c.json({ error: err.message }, err.status)
    }
    console.error(err)
    return c.json({ error: 'Internal server error' }, 500)
  })

  app.get('/health', (c) => c.json({ status: 'ok' }))

  return app
}
