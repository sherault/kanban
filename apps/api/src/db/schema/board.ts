import { sqliteTable, text, real, primaryKey } from 'drizzle-orm/sqlite-core'
import { sql } from 'drizzle-orm'
import { users } from './identity.js'
import { projects } from './project.js'

export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  projectId: text('project_id')
    .notNull()
    .references(() => projects.id, { onDelete: 'cascade' }),
  column: text('column', { enum: ['ideas', 'todo', 'doing', 'done'] })
    .notNull()
    .default('todo'),
  title: text('title').notNull(),
  description: text('description'),
  objective: text('objective'),
  startDate: text('start_date').notNull(),
  endDate: text('end_date').notNull(),
  backgroundColor: text('background_color'),
  globalSubject: text('global_subject'),
  reporterId: text('reporter_id')
    .notNull()
    .references(() => users.id),
  doerId: text('doer_id').references(() => users.id),
  validatorId: text('validator_id').references(() => users.id),
  // Fractional indexing: new task = max(position)+1, insert between a and b = (a+b)/2
  position: real('position').notNull().default(0),
  createdAt: text('created_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text('updated_at')
    .notNull()
    .default(sql`(datetime('now'))`),
})

export const taskTags = sqliteTable(
  'task_tags',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.taskId, table.tag] }),
  })
)

// Undirected: always query WHERE task_id = ? OR linked_task_id = ?
export const taskLinks = sqliteTable(
  'task_links',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    linkedTaskId: text('linked_task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.taskId, table.linkedTaskId] }),
  })
)

export const taskWatchers = sqliteTable(
  'task_watchers',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.taskId, table.userId] }),
  })
)

export const taskAdvisors = sqliteTable(
  'task_advisors',
  {
    taskId: text('task_id')
      .notNull()
      .references(() => tasks.id, { onDelete: 'cascade' }),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
  },
  (table) => ({
    pk: primaryKey({ columns: [table.taskId, table.userId] }),
  })
)

export const taskHistory = sqliteTable('task_history', {
  id: text('id').primaryKey(),
  taskId: text('task_id')
    .notNull()
    .references(() => tasks.id, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.id),
  field: text('field').notNull(),
  oldValue: text('old_value'),
  newValue: text('new_value'),
  changedAt: text('changed_at')
    .notNull()
    .default(sql`(datetime('now'))`),
  batchId: text('batch_id'),
})
