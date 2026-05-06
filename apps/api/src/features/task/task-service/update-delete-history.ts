import { eq, sql } from "drizzle-orm";
import type { TaskDto, TaskHistoryDto } from "@kanban/shared";
import { generateId } from "../../../lib/id.js";
import {
  tasks,
  taskHistory,
  taskTags,
  users,
} from "../../../db/schema/index.js";
import { TaskServiceBase } from "./base.js";

export interface UpdateTaskInput {
  title?: string | undefined;
  description?: string | null | undefined;
  objective?: string | null | undefined;
  startDate?: string | undefined;
  endDate?: string | undefined;
  backgroundColor?: string | null | undefined;
  globalSubject?: string | null | undefined;
  doerId?: string | null | undefined;
  validatorId?: string | null | undefined;
  tags?: string[] | undefined;
}

export class TaskUpdateHistoryOperations extends TaskServiceBase {
  updateTask(
    taskId: string,
    actorId: string,
    input: UpdateTaskInput,
    isMcp?: boolean,
  ): TaskDto {
    const existing = this.getRow(taskId);
    const batchId = generateId();
    const historyEntries: Array<typeof taskHistory.$inferInsert> = [];
    const updateSet: Record<string, unknown> = {};
    const track = (
      field: string,
      oldVal: string | null,
      newVal: string | null,
    ) => {
      if (oldVal === newVal) return;
      historyEntries.push({
        id: generateId(),
        taskId,
        userId: actorId,
        field,
        oldValue: oldVal,
        newValue: newVal,
        batchId,
      });
      updateSet[field] = newVal;
    };

    if (input.title !== undefined) track("title", existing.title, input.title);
    if (input.description !== undefined)
      track("description", existing.description, input.description);
    if (input.objective !== undefined)
      track("objective", existing.objective, input.objective);
    if (input.startDate !== undefined)
      track("startDate", existing.startDate, input.startDate);
    if (input.endDate !== undefined)
      track("endDate", existing.endDate, input.endDate);
    if (input.backgroundColor !== undefined)
      track("backgroundColor", existing.backgroundColor, input.backgroundColor);
    if (input.globalSubject !== undefined)
      track("globalSubject", existing.globalSubject, input.globalSubject);
    if (input.doerId !== undefined)
      track("doerId", existing.doerId, input.doerId);
    if (input.validatorId !== undefined)
      track("validatorId", existing.validatorId, input.validatorId);

    if (historyEntries.length > 0) {
      this.db
        .update(tasks)
        .set({ ...updateSet, updatedAt: sql`(datetime('now'))` })
        .where(eq(tasks.id, taskId))
        .run();
      for (const entry of historyEntries) {
        this.db.insert(taskHistory).values(entry).run();
      }
    }

    if (input.tags !== undefined) {
      this.db.delete(taskTags).where(eq(taskTags.taskId, taskId)).run();
      for (const tag of input.tags) {
        this.db.insert(taskTags).values({ taskId, tag }).run();
      }
      this.db
        .insert(taskHistory)
        .values({
          id: generateId(),
          taskId,
          userId: actorId,
          field: "tags",
          oldValue: "REST_REPLACED",
          newValue: input.tags.join(", "),
          batchId,
        })
        .run();
    }

    const updated = this.getRow(taskId);
    const dto = this.assemble(updated);
    this.broadcast(`project:${updated.projectId}`, {
      type: "task.updated",
      payload: dto,
      actorId,
      isMcp,
    });
    return dto;
  }

  deleteTask(taskId: string, actorId?: string, isMcp?: boolean): void {
    try {
      this.logger.info(`Deleting task: ${taskId}`);
      const existing = this.getRow(taskId);
      this.db.delete(tasks).where(eq(tasks.id, taskId)).run();
      this.broadcast(`project:${existing.projectId}`, {
        type: "task.deleted",
        payload: { id: taskId, projectId: existing.projectId },
        actorId,
        isMcp,
      });
      this.logger.info(`Successfully deleted task: ${taskId}`);
    } catch (error) {
      this.logger.error(`Failed to delete task: ${taskId}`, error);
      throw error;
    }
  }

  getTaskHistory(taskId: string): TaskHistoryDto[] {
    const rows = this.db
      .select()
      .from(taskHistory)
      .where(eq(taskHistory.taskId, taskId))
      .all();

    return rows.map((row) => {
      const actor = this.db
        .select({ id: users.id, displayName: users.displayName })
        .from(users)
        .where(eq(users.id, row.userId))
        .get()!;
      return {
        id: row.id,
        taskId: row.taskId,
        actor,
        field: row.field,
        oldValue: row.oldValue,
        newValue: row.newValue,
        changedAt: row.changedAt,
        batchId: row.batchId,
      };
    });
  }
}
