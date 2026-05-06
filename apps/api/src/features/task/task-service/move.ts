import { eq, sql } from "drizzle-orm";
import type { Column, TaskDto } from "@kanban/shared";
import { generateId } from "../../../lib/id.js";
import { taskHistory, tasks } from "../../../db/schema/index.js";
import { TaskServiceBase } from "./base.js";

export class TaskMoveOperations extends TaskServiceBase {
  moveTask(
    taskId: string,
    actorId: string,
    input: { column: Column },
    isMcp?: boolean,
  ): TaskDto {
    const row = this.getRow(taskId);
    const oldColumn = row.column as Column;
    const autoAssignDoer = input.column === "doing" && !row.doerId;
    const clearsDoer =
      (input.column === "ideas" || input.column === "todo") &&
      row.doerId !== null;
    const position = this.nextPosition(row.projectId, input.column);

    this.db
      .update(tasks)
      .set({
        column: input.column,
        position,
        updatedAt: sql`(datetime('now'))`,
        ...(autoAssignDoer ? { doerId: actorId } : {}),
        ...(clearsDoer ? { doerId: null } : {}),
      })
      .where(eq(tasks.id, taskId))
      .run();

    const batchId = autoAssignDoer ? generateId() : null;
    if (input.column !== oldColumn) {
      this.insertMoveHistory(
        taskId,
        actorId,
        "column",
        oldColumn,
        input.column,
        batchId,
      );
    }
    if (autoAssignDoer) {
      this.insertMoveHistory(taskId, actorId, "doerId", null, actorId, batchId);
    }
    if (clearsDoer) {
      this.insertMoveHistory(taskId, actorId, "doerId", row.doerId, null, null);
    }

    const updated = this.getRow(taskId);
    const dto = this.assemble(updated);
    this.broadcast(`project:${row.projectId}`, {
      type: "task.updated",
      payload: dto,
      actorId,
      isMcp,
    });
    return dto;
  }

  private insertMoveHistory(
    taskId: string,
    actorId: string,
    field: "column" | "doerId",
    oldValue: string | null,
    newValue: string | null,
    batchId: string | null,
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
        batchId,
      })
      .run();
  }
}
