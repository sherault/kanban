import { and, eq, sql } from "drizzle-orm";
import type { TaskDto } from "@kanban/shared";
import type { AppDb } from "../../../types.js";
import { generateId } from "../../../lib/id.js";
import { notFound, unprocessable } from "../../../lib/errors.js";
import { taskHistory, tasks } from "../../../db/schema/index.js";
import { assembleTaskDto, TaskServiceBase } from "./base.js";

export class TaskArchiveOperations extends TaskServiceBase {
  archiveTasks(
    projectId: string,
    taskIds: string[],
    actorId: string,
    isMcp?: boolean,
  ): void {
    const now = new Date().toISOString();
    for (const taskId of taskIds) {
      const row = this.db
        .select()
        .from(tasks)
        .where(and(eq(tasks.id, taskId), eq(tasks.projectId, projectId)))
        .get();
      if (!row || row.column !== "done") continue;
      this.db
        .update(tasks)
        .set({ archivedAt: now, updatedAt: sql`(datetime('now'))` })
        .where(eq(tasks.id, taskId))
        .run();
      this.db
        .insert(taskHistory)
        .values({
          id: generateId(),
          taskId,
          userId: actorId,
          field: "archivedAt",
          oldValue: null,
          newValue: now,
          batchId: null,
        })
        .run();
      this.broadcast(`project:${projectId}`, {
        type: "task.deleted",
        payload: { id: taskId, projectId },
        actorId,
        isMcp,
      });
    }
  }

  restoreTask(taskId: string, actorId: string, isMcp?: boolean): TaskDto {
    try {
      this.logger.info(`Restoring task: ${taskId} by actor: ${actorId}`);
      const row = this.getRow(taskId);
      if (!row.archivedAt) throw unprocessable("Task is not archived");

      const position = this.nextPosition(row.projectId, "todo");
      const timestamp = new Date().toISOString();
      const result = this.db.transaction((tx) => {
        tx.update(tasks)
          .set({
            archivedAt: null,
            column: "todo",
            position,
            updatedAt: timestamp,
          })
          .where(eq(tasks.id, taskId))
          .run();
        tx.insert(taskHistory)
          .values({
            id: generateId(),
            taskId,
            userId: actorId,
            field: "archivedAt",
            oldValue: row.archivedAt,
            newValue: null,
            batchId: null,
          })
          .run();

        const updated = tx
          .select()
          .from(tasks)
          .where(eq(tasks.id, taskId))
          .get();
        if (!updated) throw notFound("Task not found after update");
        const dto = assembleTaskDto(tx as unknown as AppDb, updated);
        this.broadcast(`project:${row.projectId}`, {
          type: "task.created",
          payload: dto,
          actorId,
          isMcp,
        });
        return dto;
      });

      this.logger.info(`Successfully restored task: ${taskId}`);
      return result;
    } catch (error) {
      this.logger.error(`Failed to restore task: ${taskId}`, error);
      throw error;
    }
  }
}
