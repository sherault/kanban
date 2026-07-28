import { eq, sql } from "drizzle-orm";
import type { Column, TaskDto, TaskHistorySource } from "@kanban/shared";
import { generateId } from "../../../lib/id.js";
import { unprocessable } from "../../../lib/errors.js";
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
    // MCP callers get no auto doer, so the doer rule must be enforced here or
    // tasks land in "doing" nameless: invisible to avatar filters, unsigned notes.
    if (isMcp && input.column === "doing" && !row.doerId) {
      throw unprocessable('Moving to "doing" requires a doer assigned');
    }
    // Auto doer assignment/clearing serves drag & drop ergonomics only.
    // MCP callers set the doer explicitly and must not be second-guessed.
    const autoAssignDoer = !isMcp && input.column === "doing" && !row.doerId;
    const clearsDoer =
      !isMcp &&
      (input.column === "ideas" || input.column === "todo") &&
      row.doerId !== null;
    const position = this.nextPosition(row.projectId, input.column);
    const source = this.historySource(isMcp);

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
        source,
      );
    }
    if (autoAssignDoer) {
      this.insertMoveHistory(
        taskId,
        actorId,
        "doerId",
        null,
        actorId,
        batchId,
        source,
      );
    }
    if (clearsDoer) {
      this.insertMoveHistory(
        taskId,
        actorId,
        "doerId",
        row.doerId,
        null,
        null,
        source,
      );
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
    source: TaskHistorySource,
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
        source,
      })
      .run();
  }
}
