import Database from 'better-sqlite3'
import type BetterSqlite3 from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as schema from './schema/index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const migrationsFolder = join(__dirname, '../../drizzle/migrations')

export function createTestDb(): { db: ReturnType<typeof drizzle<typeof schema>>; close: () => void } {
  const sqlite: BetterSqlite3.Database = new Database(':memory:')
  sqlite.pragma('foreign_keys = ON')
  const db = drizzle(sqlite, { schema })
  migrate(db, { migrationsFolder })
  return { db, close: () => sqlite.close() }
}
