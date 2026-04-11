import { eq, and, or, max, sql, isNull, isNotNull } from 'drizzle-orm'
import type { AppDb, Broadcaster } from '../../types.js'
import { noopBroadcaster } from '../../types.js'
import type { TaskDto, TaskHistoryDto, Column } from '@kanban/shared'
import { generateId } from '../../lib/id.js'
import { notFound, unprocessable } from '../../lib/errors.js'
import { parseCsvImport } from './csv-import.js'
import {
  tasks,
  taskTags,
  taskLinks,
  taskWatchers,
  taskAdvisors,
  taskHistory,
  users,
  projects,
  memberships,
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
    archivedAt: row.archivedAt ?? null,
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

  private assertOrgMember(projectId: string, userId: string): void {
    const project = this.db.select({ organizationId: projects.organizationId })
      .from(projects).where(eq(projects.id, projectId)).get()
    if (!project) throw notFound('Project not found')
    const membership = this.db.select({ role: memberships.role })
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, project.organizationId)))
      .get()
    if (!membership) throw notFound('User not found')
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
      description?: string | null | undefined
      objective?: string | null | undefined
      startDate: string
      endDate: string
      backgroundColor?: string | null | undefined
      globalSubject?: string | null | undefined
      column?: Column | undefined
      doerId?: string | null | undefined
      validatorId?: string | null | undefined
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
    const rows = this.db.select().from(tasks).where(and(eq(tasks.projectId, projectId), isNull(tasks.archivedAt))).all()
    return rows.map((r) => assembleTaskDto(this.db, r))
  }

  updateTask(
    taskId: string,
    actorId: string,
    input: {
      title?: string | undefined
      description?: string | null | undefined
      objective?: string | null | undefined
      startDate?: string | undefined
      endDate?: string | undefined
      backgroundColor?: string | null | undefined
      globalSubject?: string | null | undefined
      doerId?: string | null | undefined
      validatorId?: string | null | undefined
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
    const linkedRow = this.getRow(linkedTaskId) // verify exists
    if (linkedRow.projectId !== row.projectId) throw notFound('Task not found')
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
    this.assertOrgMember(row.projectId, userId)
    let added = false
    try {
      this.db.insert(taskWatchers).values({ taskId, userId }).run()
      added = true
    } catch {
      // already watching — no-op
    }
    if (added) {
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'watchers',
        oldValue: null,
        newValue: userId,
        batchId: null,
      }).run()
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
    this.assertOrgMember(row.projectId, userId)
    let added = false
    try {
      this.db.insert(taskAdvisors).values({ taskId, userId }).run()
      added = true
    } catch {
      // already advising — no-op
    }
    if (added) {
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'advisors',
        oldValue: null,
        newValue: userId,
        batchId: null,
      }).run()
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

  moveTask(
    taskId: string,
    actorId: string,
    input: { column: Column; position?: number }
  ): TaskDto {
    const row = this.getRow(taskId)
    const oldColumn = row.column as Column

    // Auto-assign the actor as doer when moving to "doing" with no doer set
    const autoAssignDoer = input.column === 'doing' && !row.doerId
    const clearsDoer = (input.column === 'ideas' || input.column === 'todo') && row.doerId !== null
    const position = input.position ?? this.nextPosition(row.projectId, input.column)

    this.db.update(tasks).set({
      column: input.column,
      position,
      updatedAt: sql`(datetime('now'))`,
      ...(autoAssignDoer ? { doerId: actorId } : {}),
      ...(clearsDoer ? { doerId: null } : {}),
    }).where(eq(tasks.id, taskId)).run()

    const batchId = autoAssignDoer ? generateId() : null

    // History: column change
    if (input.column !== oldColumn) {
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'column',
        oldValue: oldColumn,
        newValue: input.column,
        batchId,
      }).run()
    }

    if (autoAssignDoer) {
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'doerId',
        oldValue: null,
        newValue: actorId,
        batchId,
      }).run()
    }

    if (clearsDoer) {
      this.db.insert(taskHistory).values({
        id: generateId(),
        taskId,
        userId: actorId,
        field: 'doerId',
        oldValue: row.doerId,
        newValue: null,
        batchId: null,
      }).run()
    }

    const updated = this.getRow(taskId)
    const dto = assembleTaskDto(this.db, updated)
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  reorderTask(taskId: string, position: number): TaskDto {
    const row = this.getRow(taskId)
    this.db
      .update(tasks)
      .set({ position, updatedAt: sql`(datetime('now'))` })
      .where(eq(tasks.id, taskId))
      .run()
    const updated = this.getRow(taskId)
    const dto = assembleTaskDto(this.db, updated)
    // Position changes are cosmetic ordering; no audit history row needed.
    this.broadcast(`project:${row.projectId}`, { type: 'task.updated', payload: dto })
    return dto
  }

  archiveTasks(projectId: string, taskIds: string[], actorId: string): void {
    const now = new Date().toISOString()
    for (const taskId of taskIds) {
      const row = this.db.select().from(tasks).where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId))).get()
      if (!row || row.column !== 'done') continue
      this.db.update(tasks).set({ archivedAt: now, updatedAt: sql`(datetime('now'))` }).where(eq(tasks.id, taskId)).run()
      this.db.insert(taskHistory).values({ id: generateId(), taskId, userId: actorId, field: 'archivedAt', oldValue: null, newValue: now, batchId: null }).run()
      this.broadcast(`project:${projectId}`, { type: 'task.deleted', payload: { id: taskId, projectId } })
    }
  }

  restoreTask(taskId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId)
    if (!row.archivedAt) throw unprocessable('Task is not archived')
    const position = this.nextPosition(row.projectId, 'todo')
    this.db.update(tasks).set({ archivedAt: null, column: 'todo', position, updatedAt: sql`(datetime('now'))` }).where(eq(tasks.id, taskId)).run()
    this.db.insert(taskHistory).values({ id: generateId(), taskId, userId: actorId, field: 'archivedAt', oldValue: row.archivedAt, newValue: null, batchId: null }).run()
    const updated = this.getRow(taskId)
    const dto = assembleTaskDto(this.db, updated)
    this.broadcast(`project:${row.projectId}`, { type: 'task.created', payload: dto })
    return dto
  }

  listArchivedTasks(projectId: string, opts: { search?: string; page?: number; limit?: number } = {}): { tasks: TaskDto[]; total: number } {
    const { search, page = 1, limit = 20 } = opts
    const offset = (page - 1) * limit

    const baseWhere = and(
      eq(tasks.projectId, projectId),
      isNotNull(tasks.archivedAt)
    )

    const countResult = this.db.select({ count: sql<number>`count(*)` }).from(tasks).where(baseWhere).get()
    const total = countResult?.count ?? 0

    let rows = this.db.select().from(tasks).where(baseWhere).orderBy(tasks.archivedAt).limit(limit).offset(offset).all()

    if (search) {
      const q = search.toLowerCase()
      rows = rows.filter(r =>
        r.title.toLowerCase().includes(q) ||
        (r.description ?? '').toLowerCase().includes(q) ||
        (r.objective ?? '').toLowerCase().includes(q) ||
        (r.globalSubject ?? '').toLowerCase().includes(q)
      )
    }

    return { tasks: rows.map(r => assembleTaskDto(this.db, r)), total }
  }

  importTasks(
    projectId: string,
    reporterId: string,
    csvText: string
  ): { imported: number; skipped: number } {
    let parseResult: ReturnType<typeof parseCsvImport>
    try {
      parseResult = parseCsvImport(csvText)
    } catch (err) {
      throw unprocessable(err instanceof Error ? err.message : 'Invalid CSV')
    }
    const { valid, skipped } = parseResult

    const imported = this.db.transaction((tx) => {
      let count = 0
      for (const row of valid) {
        const maxResult = tx
          .select({ pos: max(tasks.position) })
          .from(tasks)
          .where(and(eq(tasks.projectId, projectId), eq(tasks.column, row.column)))
          .get()
        const position = (maxResult?.pos ?? 0) + 1
        const id = generateId()
        tx.insert(tasks).values({
          id,
          projectId,
          reporterId,
          column: row.column,
          title: row.title,
          description: row.description,
          objective: row.objective,
          startDate: row.startDate,
          endDate: row.endDate,
          backgroundColor: row.backgroundColor,
          globalSubject: row.globalSubject,
          doerId: null,
          validatorId: null,
          position,
        }).run()
        count++
      }
      return count
    })

    // No per-task broadcast — bulk import is treated as a silent batch operation.
    // Clients should refresh their task list after the import completes.
    return { imported, skipped }
  }
}
