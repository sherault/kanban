import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as schema from './db/schema/index.js'

/** The concrete Drizzle DB type for this project. */
export type AppDb = BetterSQLite3Database<typeof schema>

/** Hono context environment — Variables are injected by authnMiddleware. */
export type HonoEnv = {
  Variables: {
    userId: string
    sessionId: string
  }
}
