import { eq, and, or, max, sql } from 'drizzle-orm'
import type { AppDb, Broadcaster } from '../../types.js'
import { noopBroadcaster } from '../../types.js'
import type { TaskDto, TaskHistoryDto, Column } from '@kanban/shared'
import { generateId } from '../../lib/id.js'
import { notFound } from '../../lib/errors.js'
import {
  tasks,
  taskTags,
  taskLinks,
  taskWatchers,
  taskAdvisors,
  taskHistory,
  users,
} from '../../db/schema/index.js'

// ---------- assembly helper ----------

function assembleTaskDto(
  db: AppDb,
  row: typeof tasks.$inferSelect
): TaskDto {
  const reporter = db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, row.reporterId))
    .get()!

  const doer = row.doerId
    ? (db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, row.doerId))
        .get() ?? null)
    : null

  const validator = row.validatorId
    ? (db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, row.validatorId))
        .get() ?? null)
    : null

  const tags = db
    .select({ tag: taskTags.tag })
    .from(taskTags)
    .where(eq(taskTags.taskId, row.id))
    .all()
    .map((r) => r.tag)

  const links = db
    .select()
    .from(taskLinks)
    .where(or(eq(taskLinks.taskId, row.id), eq(taskLinks.linkedTaskId, row.id)))
    .all()

  const linkedTaskIds = links.map((l) =>
    l.taskId === row.id ? l.linkedTaskId : l.taskId
  )

  const watchers = db
    .select({ id: users.id, displayName: users.displayName })
    .from(taskWatchers)
    .innerJoin(users, eq(taskWatchers.userId, users.id))
    .where(eq(taskWatchers.taskId, row.id))
    .all()

  const advisors = db
    .select({ id: users.id, displayName: users.displayName })
    .from(taskAdvisors)
    .innerJoin(users, eq(taskAdvisors.userId, users.id))
    .where(eq(taskAdvisors.taskId, row.id))
    .all()

  return {
    id: row.id,
    projectId: row.projectId,
    column: row.column as Column,
    title: row.title,
    description: row.description,
    objective: row.objective,
    startDate: row.startDate,
    endDate: row.endDate,
    backgroundColor: row.backgroundColor,
    globalSubject: row.globalSubject,
    position: row.position,
    reporter,
    doer,
    validator,
    watchers,
    advisors,
    tags,
    linkedTaskIds,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  }
}

// ---------- service ----------

export class TaskService {
  constructor(
    private readonly db: AppDb,
    private readonly broadcast: Broadcaster = noopBroadcaster
  ) {}

  private nextPosition(projectId: string, column: Column): number {
    const result = this.db
      .select({ pos: max(tasks.position) })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.column, column)))
      .get()
    return (result?.pos ?? 0) + 1
  }

  private getRow(taskId: string): typeof tasks.$inferSelect {
    const row = this.db.select().from(tasks).where(eq(tasks.id, taskId)).get()
    if (!row) throw notFound('Task not found')
    return row
  }

  createTask(
    projectId: string,
    reporterId: string,
    input: {
      title: string
      description?: string | null
      objective?: string | null
      startDate: string
      endDate: string
      backgroundColor?: string | null
      globalSubject?: string | null
      column?: Column
      doerId?: string | null
      validatorId?: string | null
    }
  ): TaskDto {
    const column: Column = input.column ?? 'todo'
    const id = generateId()
    const position = this.nextPosition(projectId, column)
    const row = this.db
      .insert(tasks)
      .values({
        id,
        projectId,
        reporterId,
        column,
        title: input.title,
        description: input.description ?? null,
        objective: input.objective ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        backgroundColor: input.backgroundColor ?? null,
        globalSubject: input.globalSubject ?? null,
        doerId: input.doerId ?? null,
        validatorId: input.validatorId ?? null,
        position,
      })
      .returning()
      .get()
    if (!row) throw new Error('Failed to create task')
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${projectId}`, { type: 'task.created', payload: dto })
    return dto
  }

  getTask(taskId: string): TaskDto | undefined {
    const row = this.db.select().from(tasks).where(eq(tasks.id, taskId)).get()
    return row ? assembleTaskDto(this.db, row) : undefined
  }

  listTasks(projectId: string): TaskDto[] {
    const rows = this.db.select().from(tasks).where(eq(tasks.projectId, projectId)).all()
    return rows.map((r) => assembleTaskDto(this.db, r))
  }

  updateTask(
    taskId: string,
    actorId: string,
    input: {
      title?: string
      description?: string | null
      objective?: string | null
      startDate?: string
      endDate?: string
      backgroundColor?: string | null
      globalSubject?: string | null
      doerId?: string | null
      validatorId?: string | null
    }
  ): TaskDto {
    const existing = this.getRow(taskId)
    const batchId = generateId()
    const historyEntries: Array<typeof taskHistory.$inferInsert> = []
    const updateSet: Record<string, unknown> = {}

    const track = (
      field: string,
      oldVal: string | null,
      newVal: string | null
    ) => {
      if (oldVal !== newVal) {
        historyEntries.push({
          id: generateId(),
          taskId,
          userId: actorId,
          field,
          oldValue: oldVal,
          newValue: newVal,
          batchId,
        })
        updateSet[field] = newVal
      }
    }

    if (input.title !== undefined) track('title', existing.title, input.title)
    if (input.description !== undefined) track('description', existing.description, input.description)
    if (input.objective !== undefined) track('objective', existing.objective, input.objective)
    if (input.startDate !== undefined) track('startDate', existing.startDate, input.startDate)
    if (input.endDate !== undefined) track('endDate', existing.endDate, input.endDate)
    if (input.backgroundColor !== undefined) track('backgroundColor', existing.backgroundColor, input.backgroundColor)
    if (input.globalSubject !== undefined) track('globalSubject', existing.globalSubject, input.globalSubject)
    if (input.doerId !== undefined) track('doerId', existing.doerId, input.doerId)
    if (input.validatorId !== undefined) track('validatorId', existing.validatorId, input.validatorId)

    if (historyEntries.length > 0) {
      this.db
        .update(tasks)
        .set({ ...updateSet, updatedAt: sql`(datetime('now'))` })
        .where(eq(tasks.id, taskId))
        .run()
      for (const entry of historyEntries) {
        this.db.insert(taskHistory).values(entry).run()
      }
    }

    const updated = this.getRow(taskId)
    const dto = assembleTaskDto(this.db, updated)
    this.broadcast(`project:${existing.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  deleteTask(taskId: string): void {
    const existing = this.getRow(taskId)
    this.db.delete(tasks).where(eq(tasks.id, taskId)).run()
    this.broadcast(`project:${existing.projectId}`, {
      type: 'task.deleted',
      payload: { id: taskId, projectId: existing.projectId },
    })
  }

  getTaskHistory(taskId: string): TaskHistoryDto[] {
    const rows = this.db
      .select()
      .from(taskHistory)
      .where(eq(taskHistory.taskId, taskId))
      .all()

    return rows.map((r) => {
      const actor = this.db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, r.userId))
        .get()!
      return {
        id: r.id,
        taskId: r.taskId,
        actor,
        field: r.field,
        oldValue: r.oldValue,
        newValue: r.newValue,
        changedAt: r.changedAt,
        batchId: r.batchId,
      }
    })
  }

  addTag(taskId: string, tag: string): TaskDto {
    const row = this.getRow(taskId)
    try {
      this.db.insert(taskTags).values({ taskId, tag }).run()
    } catch {
      // duplicate — no-op
    }
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  removeTag(taskId: string, tag: string): TaskDto {
    const row = this.getRow(taskId)
    this.db.delete(taskTags).where(and(eq(taskTags.taskId, taskId), eq(taskTags.tag, tag))).run()
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  addLink(taskId: string, linkedTaskId: string): TaskDto {
    const row = this.getRow(taskId)
    this.getRow(linkedTaskId) // verify exists
    try {
      this.db.insert(taskLinks).values({ taskId, linkedTaskId }).run()
    } catch {
      // duplicate or reverse already exists — no-op
    }
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  removeLink(taskId: string, linkedTaskId: string): TaskDto {
    const row = this.getRow(taskId)
    this.db.delete(taskLinks).where(
      or(
        and(eq(taskLinks.taskId, taskId), eq(taskLinks.linkedTaskId, linkedTaskId)),
        and(eq(taskLinks.taskId, linkedTaskId), eq(taskLinks.linkedTaskId, taskId))
      )
    ).run()
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  addWatcher(taskId: string, userId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId)
    try {
      this.db.insert(taskWatchers).values({ taskId, userId }).run()
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'watchers',
        oldValue: null,
        newValue: userId,
        batchId: null,
      }).run()
    } catch {
      // already watching — no-op
    }
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  removeWatcher(taskId: string, userId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId)
    const existing = this.db.select().from(taskWatchers)
      .where(and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.userId, userId)))
      .get()
    if (existing) {
      this.db.delete(taskWatchers).where(
        and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.userId, userId))
      ).run()
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'watchers',
        oldValue: userId,
        newValue: null,
        batchId: null,
      }).run()
    }
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  addAdvisor(taskId: string, userId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId)
    try {
      this.db.insert(taskAdvisors).values({ taskId, userId }).run()
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'advisors',
        oldValue: null,
        newValue: userId,
        batchId: null,
      }).run()
    } catch {
      // already advising — no-op
    }
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  removeAdvisor(taskId: string, userId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId)
    const existing = this.db.select().from(taskAdvisors)
      .where(and(eq(taskAdvisors.taskId, taskId), eq(taskAdvisors.userId, userId)))
      .get()
    if (existing) {
      this.db.delete(taskAdvisors).where(
        and(eq(taskAdvisors.taskId, taskId), eq(taskAdvisors.userId, userId))
      ).run()
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'advisors',
        oldValue: userId,
        newValue: null,
        batchId: null,
      }).run()
    }
    const dto = assembleTaskDto(this.db, row)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }
}
