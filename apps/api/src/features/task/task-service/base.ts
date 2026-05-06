import { and, eq, max, or } from "drizzle-orm";
import type { Column, TaskDto } from "@kanban/shared";
import { createLogger } from "@kanban/shared";
import type { AppDb, Broadcaster } from "../../../types.js";
import { notFound } from "../../../lib/errors.js";
import {
  memberships,
  projects,
  taskAdvisors,
  taskLinks,
  tasks,
  taskTags,
  taskWatchers,
  users,
} from "../../../db/schema/index.js";

export type TaskRow = typeof tasks.$inferSelect;

export function assembleTaskDto(db: AppDb, row: TaskRow): TaskDto {
  const reporter = db
    .select({ id: users.id, displayName: users.displayName })
    .from(users)
    .where(eq(users.id, row.reporterId))
    .get()!;
  const doer = row.doerId
    ? (db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, row.doerId))
        .get() ?? null)
    : null;
  const validator = row.validatorId
    ? (db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, row.validatorId))
        .get() ?? null)
    : null;
  const tags = db
    .select({ tag: taskTags.tag })
    .from(taskTags)
    .where(eq(taskTags.taskId, row.id))
    .all()
    .map((r) => r.tag);
  const links = db
    .select()
    .from(taskLinks)
    .where(or(eq(taskLinks.taskId, row.id), eq(taskLinks.linkedTaskId, row.id)))
    .all();
  const linkedTaskIds = links.map((link) =>
    link.taskId === row.id ? link.linkedTaskId : link.taskId,
  );
  const watchers = db
    .select({ id: users.id, displayName: users.displayName })
    .from(taskWatchers)
    .innerJoin(users, eq(taskWatchers.userId, users.id))
    .where(eq(taskWatchers.taskId, row.id))
    .all();
  const advisors = db
    .select({ id: users.id, displayName: users.displayName })
    .from(taskAdvisors)
    .innerJoin(users, eq(taskAdvisors.userId, users.id))
    .where(eq(taskAdvisors.taskId, row.id))
    .all();
  const project = db
    .select({ name: projects.name })
    .from(projects)
    .where(eq(projects.id, row.projectId))
    .get();

  return {
    id: row.id,
    projectId: row.projectId,
    projectName: project?.name ?? "",
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
  };
}

export class TaskServiceBase {
  protected logger = createLogger("TaskService");

  constructor(
    protected readonly db: AppDb,
    protected readonly broadcast: Broadcaster,
  ) {}

  protected nextPosition(projectId: string, column: Column): number {
    const result = this.db
      .select({ pos: max(tasks.position) })
      .from(tasks)
      .where(and(eq(tasks.projectId, projectId), eq(tasks.column, column)))
      .get();
    return (result?.pos ?? 0) + 1;
  }

  protected assertOrgMember(projectId: string, userId: string): void {
    const organizationId = this.getProjectOrgId(projectId);
    if (!organizationId) throw notFound("Project not found");
    const membership = this.db
      .select({ role: memberships.role })
      .from(memberships)
      .where(
        and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, organizationId),
        ),
      )
      .get();
    if (!membership) throw notFound("User not found");
  }

  protected getProjectOrgId(projectId: string): string | undefined {
    return this.db
      .select({ organizationId: projects.organizationId })
      .from(projects)
      .where(eq(projects.id, projectId))
      .get()?.organizationId;
  }

  protected getRow(taskId: string): TaskRow {
    const row = this.db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    if (!row) throw notFound("Task not found");
    return row;
  }

  protected assemble(row: TaskRow): TaskDto {
    return assembleTaskDto(this.db, row);
  }
}
