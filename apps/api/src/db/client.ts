import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema/index.js'

const databaseUrl = process.env['DATABASE_URL'] ?? './kanban.db'

const sqlite = new Database(databaseUrl)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
export { sqlite }
