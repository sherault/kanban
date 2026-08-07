import { eq } from "drizzle-orm";
import type { AppDb, Broadcaster } from "../../types.js";
import { noopBroadcaster } from "../../types.js";
import type { ProjectDto } from "@kanban/shared";
import { generateId } from "../../lib/id.js";
import { notFound, unprocessable } from "../../lib/errors.js";
import { projects } from "../../db/schema/index.js";
import {
  syncOrganizationIndexForProjectArchived,
  syncOrganizationIndexForProjectCreated,
  syncOrganizationIndexForProjectDeleted,
  syncOrganizationIndexForProjectRestored,
} from "../wiki/wiki-service/project-index.js";

function toDto(row: typeof projects.$inferSelect): ProjectDto {
  return {
    id: row.id,
    organizationId: row.organizationId,
    name: row.name,
    archivedAt: row.archivedAt ?? null,
    createdAt: row.createdAt,
  };
}

export class ProjectService {
  constructor(
    private readonly db: AppDb,
    private readonly broadcast: Broadcaster = noopBroadcaster,
  ) {}

  createProject(
    orgId: string,
    input: { name: string },
    userId?: string,
  ): ProjectDto {
    const id = generateId();
    const row = this.db
      .insert(projects)
      .values({ id, organizationId: orgId, name: input.name })
      .returning()
      .get();
    if (!row) throw new Error("Failed to create project");
    const dto = toDto(row);
    this.broadcast(`org:${orgId}`, { type: "project.created", payload: dto });
    syncOrganizationIndexForProjectCreated(
      { db: this.db, broadcast: this.broadcast },
      orgId,
      userId,
    );
    return dto;
  }

  listProjects(orgId: string): ProjectDto[] {
    return this.db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, orgId))
      .all()
      .map(toDto);
  }

  getProject(projectId: string): ProjectDto | undefined {
    const row = this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
    return row ? toDto(row) : undefined;
  }

  updateProject(
    orgId: string,
    projectId: string,
    input: { name: string },
  ): ProjectDto {
    this.requireProject(orgId, projectId);
    const updated = this.db
      .update(projects)
      .set({ name: input.name })
      .where(eq(projects.id, projectId))
      .returning()
      .get();
    if (!updated) throw new Error("Failed to update project");
    const dto = toDto(updated);
    this.broadcast(`org:${orgId}`, { type: "project.updated", payload: dto });
    return dto;
  }

  archiveProject(
    orgId: string,
    projectId: string,
    userId?: string,
  ): ProjectDto {
    const existing = this.requireProject(orgId, projectId);
    if (existing.archivedAt) throw unprocessable("Project is already archived");
    const updated = this.db
      .update(projects)
      .set({ archivedAt: new Date().toISOString() })
      .where(eq(projects.id, projectId))
      .returning()
      .get();
    if (!updated) throw new Error("Failed to archive project");
    const dto = toDto(updated);
    this.broadcast(`org:${orgId}`, { type: "project.updated", payload: dto });
    syncOrganizationIndexForProjectArchived(
      { db: this.db, broadcast: this.broadcast },
      orgId,
      { id: updated.id, name: updated.name },
      userId,
    );
    return dto;
  }

  restoreProject(
    orgId: string,
    projectId: string,
    userId?: string,
  ): ProjectDto {
    const existing = this.requireProject(orgId, projectId);
    if (!existing.archivedAt) throw unprocessable("Project is not archived");
    const updated = this.db
      .update(projects)
      .set({ archivedAt: null })
      .where(eq(projects.id, projectId))
      .returning()
      .get();
    if (!updated) throw new Error("Failed to restore project");
    const dto = toDto(updated);
    this.broadcast(`org:${orgId}`, { type: "project.updated", payload: dto });
    syncOrganizationIndexForProjectRestored(
      { db: this.db, broadcast: this.broadcast },
      orgId,
      { id: updated.id, name: updated.name },
      userId,
    );
    return dto;
  }

  deleteProject(orgId: string, projectId: string, userId?: string): void {
    const existing = this.requireProject(orgId, projectId);
    syncOrganizationIndexForProjectDeleted(
      { db: this.db, broadcast: this.broadcast },
      orgId,
      existing,
      userId,
    );
    this.db.delete(projects).where(eq(projects.id, projectId)).run();
    this.broadcast(`org:${orgId}`, {
      type: "project.deleted",
      payload: { id: projectId },
    });
  }

  private requireProject(orgId: string, projectId: string) {
    const existing = this.db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId))
      .get();
    if (!existing) throw notFound("Project not found");
    if (existing.organizationId !== orgId) throw notFound("Project not found");
    return existing;
  }
}
