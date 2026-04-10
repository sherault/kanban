import { eq } from 'drizzle-orm'
import type { AppDb, Broadcaster } from '../../types.js'
import { noopBroadcaster } from '../../types.js'
import type { ProjectDto } from '@kanban/shared'
import { generateId } from '../../lib/id.js'
import { notFound } from '../../lib/errors.js'
import { projects } from '../../db/schema/index.js'

function toDto(row: typeof projects.$inferSelect): ProjectDto {
  return { id: row.id, organizationId: row.organizationId, name: row.name, createdAt: row.createdAt }
}

export class ProjectService {
  constructor(
    private readonly db: AppDb,
    private readonly broadcast: Broadcaster = noopBroadcaster
  ) {}

  createProject(orgId: string, input: { name: string }): ProjectDto {
    const id = generateId()
    const row = this.db
      .insert(projects)
      .values({ id, organizationId: orgId, name: input.name })
      .returning()
      .get()
    if (!row) throw new Error('Failed to create project')
    const dto = toDto(row)
    this.broadcast(`org:${orgId}`, { type: 'project.created', payload: dto })
    return dto
  }

  listProjects(orgId: string): ProjectDto[] {
    return this.db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, orgId))
      .all()
      .map(toDto)
  }

  getProject(projectId: string): ProjectDto | undefined {
    const row = this.db.select().from(projects).where(eq(projects.id, projectId)).get()
    return row ? toDto(row) : undefined
  }

  updateProject(orgId: string, projectId: string, input: { name: string }): ProjectDto {
    const existing = this.db.select().from(projects).where(eq(projects.id, projectId)).get()
    if (!existing) throw notFound('Project not found')
    if (existing.organizationId !== orgId) throw notFound('Project not found')
    const updated = this.db
      .update(projects)
      .set({ name: input.name })
      .where(eq(projects.id, projectId))
      .returning()
      .get()
    if (!updated) throw new Error('Failed to update project')
    const dto = toDto(updated)
    this.broadcast(`org:${orgId}`, { type: 'project.updated', payload: dto })
    return dto
  }

  deleteProject(orgId: string, projectId: string): void {
    const existing = this.db.select().from(projects).where(eq(projects.id, projectId)).get()
    if (!existing) throw notFound('Project not found')
    if (existing.organizationId !== orgId) throw notFound('Project not found')
    this.db.delete(projects).where(eq(projects.id, projectId)).run()
    this.broadcast(`org:${orgId}`, { type: 'project.deleted', payload: { id: projectId } })
  }
}
