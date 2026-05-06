import { and, eq, or } from "drizzle-orm";
import type { TaskDto } from "@kanban/shared";
import { generateId } from "../../../lib/id.js";
import { notFound } from "../../../lib/errors.js";
import { taskHistory, taskLinks, taskTags } from "../../../db/schema/index.js";
import { TaskServiceBase } from "./base.js";

export class TaskRelationOperations extends TaskServiceBase {
  addTag(taskId: string, tag: string, actorId: string): TaskDto {
    const row = this.getRow(taskId);
    let inserted = false;
    try {
      this.db.insert(taskTags).values({ taskId, tag }).run();
      inserted = true;
    } catch {
      // duplicate, no-op
    }

    if (inserted) {
      this.db
        .insert(taskHistory)
        .values({
          id: generateId(),
          taskId,
          userId: actorId,
          field: "tags",
          oldValue: null,
          newValue: tag,
          changedAt: new Date().toISOString(),
          batchId: null,
        })
        .run();
    }

    const dto = this.assemble(row);
    this.broadcast(`project:${row.projectId}`, {
      type: "task.updated",
      payload: dto,
      actorId,
    });
    return dto;
  }

  removeTag(taskId: string, tag: string, actorId: string): TaskDto {
    const row = this.getRow(taskId);
    const changes = this.db
      .delete(taskTags)
      .where(and(eq(taskTags.taskId, taskId), eq(taskTags.tag, tag)))
      .run();
    if (changes.changes > 0) {
      this.db
        .insert(taskHistory)
        .values({
          id: generateId(),
          taskId,
          userId: actorId,
          field: "tags",
          oldValue: tag,
          newValue: null,
          changedAt: new Date().toISOString(),
          batchId: null,
        })
        .run();
    }

    const dto = this.assemble(row);
    this.broadcast(`project:${row.projectId}`, {
      type: "task.updated",
      payload: dto,
      actorId,
    });
    return dto;
  }

  addLink(taskId: string, linkedTaskId: string, actorId?: string): TaskDto {
    const row = this.getRow(taskId);
    const linkedRow = this.getRow(linkedTaskId);

    if (
      this.getProjectOrgId(row.projectId) !==
      this.getProjectOrgId(linkedRow.projectId)
    ) {
      throw notFound("Task not found");
    }

    try {
      this.db.insert(taskLinks).values({ taskId, linkedTaskId }).run();
    } catch {
      // duplicate or reverse already exists, no-op
    }

    const dto = this.assemble(row);
    this.broadcast(`project:${row.projectId}`, {
      type: "task.updated",
      payload: dto,
      actorId,
    });
    return dto;
  }

  removeLink(taskId: string, linkedTaskId: string, actorId?: string): TaskDto {
    const row = this.getRow(taskId);
    this.db
      .delete(taskLinks)
      .where(
        or(
          and(
            eq(taskLinks.taskId, taskId),
            eq(taskLinks.linkedTaskId, linkedTaskId),
          ),
          and(
            eq(taskLinks.taskId, linkedTaskId),
            eq(taskLinks.linkedTaskId, taskId),
          ),
        ),
      )
      .run();

    const dto = this.assemble(row);
    this.broadcast(`project:${row.projectId}`, {
      type: "task.updated",
      payload: dto,
      actorId,
    });
    return dto;
  }
}
