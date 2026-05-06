import { and, eq } from "drizzle-orm";
import type { TaskDto } from "@kanban/shared";
import { generateId } from "../../../lib/id.js";
import {
  taskAdvisors,
  taskHistory,
  taskWatchers,
} from "../../../db/schema/index.js";
import { TaskServiceBase } from "./base.js";

export class TaskParticipantOperations extends TaskServiceBase {
  addWatcher(taskId: string, userId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId);
    this.assertOrgMember(row.projectId, userId);
    let added = false;
    try {
      this.db.insert(taskWatchers).values({ taskId, userId }).run();
      added = true;
    } catch {
      // already watching, no-op
    }
    if (added) {
      this.insertParticipantHistory(taskId, actorId, "watchers", null, userId);
    }
    return this.broadcastParticipantUpdate(row, actorId);
  }

  removeWatcher(taskId: string, userId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId);
    const existing = this.db
      .select()
      .from(taskWatchers)
      .where(
        and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.userId, userId)),
      )
      .get();
    if (existing) {
      this.db
        .delete(taskWatchers)
        .where(
          and(eq(taskWatchers.taskId, taskId), eq(taskWatchers.userId, userId)),
        )
        .run();
      this.insertParticipantHistory(taskId, actorId, "watchers", userId, null);
    }
    return this.broadcastParticipantUpdate(row, actorId);
  }

  addAdvisor(taskId: string, userId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId);
    this.assertOrgMember(row.projectId, userId);
    let added = false;
    try {
      this.db.insert(taskAdvisors).values({ taskId, userId }).run();
      added = true;
    } catch {
      // already advising, no-op
    }
    if (added) {
      this.insertParticipantHistory(taskId, actorId, "advisors", null, userId);
    }
    return this.broadcastParticipantUpdate(row, actorId);
  }

  removeAdvisor(taskId: string, userId: string, actorId: string): TaskDto {
    const row = this.getRow(taskId);
    const existing = this.db
      .select()
      .from(taskAdvisors)
      .where(
        and(eq(taskAdvisors.taskId, taskId), eq(taskAdvisors.userId, userId)),
      )
      .get();
    if (existing) {
      this.db
        .delete(taskAdvisors)
        .where(
          and(eq(taskAdvisors.taskId, taskId), eq(taskAdvisors.userId, userId)),
        )
        .run();
      this.insertParticipantHistory(taskId, actorId, "advisors", userId, null);
    }
    return this.broadcastParticipantUpdate(row, actorId);
  }

  private insertParticipantHistory(
    taskId: string,
    actorId: string,
    field: "watchers" | "advisors",
    oldValue: string | null,
    newValue: string | null,
  ) {
    this.db
      .insert(taskHistory)
      .values({
        id: generateId(),
        taskId,
        userId: actorId,
        field,
        oldValue,
        newValue,
        batchId: null,
      })
      .run();
  }

  private broadcastParticipantUpdate(
    row: ReturnType<TaskParticipantOperations["getRow"]>,
    actorId: string,
  ): TaskDto {
    const dto = this.assemble(row);
    this.broadcast(`project:${row.projectId}`, {
      type: "task.updated",
      payload: dto,
      actorId,
    });
    return dto;
  }
}
