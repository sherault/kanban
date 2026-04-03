import { migrate } from 'drizzle-orm/better-sqlite3/migrator'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { db } from './client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

export function runMigrations(): void {
  migrate(db, { migrationsFolder: join(__dirname, '../../drizzle/migrations') })
}
