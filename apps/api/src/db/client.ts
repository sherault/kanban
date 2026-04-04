import Database from 'better-sqlite3'
import type BetterSqlite3 from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema/index.js'

const databaseUrl = process.env['DATABASE_URL'] ?? './kanban.db'

export const sqlite: BetterSqlite3.Database = new Database(databaseUrl)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

export const db = drizzle(sqlite, { schema })
