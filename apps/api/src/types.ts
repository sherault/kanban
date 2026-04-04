import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as schema from './db/schema/index.js'
import type { ProjectDto, TaskDto } from '@kanban/shared'

/** The concrete Drizzle DB type for this project. */
export type AppDb = BetterSQLite3Database<typeof schema>

/** Hono context environment — Variables are injected by middleware. */
export type HonoEnv = {
  Variables: {
    userId: string
    sessionId: string
    orgId: string
  }
}

/** Discriminated union of all WebSocket events broadcast to clients. */
export type WsEvent =
  | { type: 'project.created'; payload: ProjectDto }
  | { type: 'project.updated'; payload: ProjectDto }
  | { type: 'project.deleted'; payload: { id: string } }
  | { type: 'task.created'; payload: TaskDto }
  | { type: 'task.updated'; payload: TaskDto }
  | { type: 'task.deleted'; payload: { id: string; projectId: string } }

/** Function that broadcasts a WsEvent to all subscribers of a room. */
export type Broadcaster = (room: string, event: WsEvent) => void

/** No-op broadcaster — used as default in tests and factory defaults. */
export const noopBroadcaster: Broadcaster = () => {}
