import { eq } from "drizzle-orm";
import type { TaskDto } from "@kanban/shared";
import type { AppDb } from "../../../types.js";
import { generateId } from "../../../lib/id.js";
import { notFound, unprocessable } from "../../../lib/errors.js";
import { taskHistory, tasks } from "../../../db/schema/index.js";
import { assembleTaskDto, TaskServiceBase } from "./base.js";

export class TaskTransferOperations extends TaskServiceBase {
  /**
   * Re-homes a task in another project of the same organization. The row is
   * updated in place so id, history, links, tags and participants follow it;
   * only the project and the position within its (unchanged) column move.
   */
  transferTask(
    taskId: string,
    actorId: string,
    input: { targetProjectId: string },
    isMcp?: boolean,
  ): TaskDto {
    const row = this.getRow(taskId);
    this.assertOrgMember(row.projectId, actorId);
    // Another org's project answers like a missing one: no existence leak.
    if (
      this.getProjectOrgId(input.targetProjectId) !==
      this.getProjectOrgId(row.projectId)
    ) {
      throw notFound("Project not found");
    }
    if (input.targetProjectId === row.projectId) {
      throw unprocessable("Task is already in this project");
    }

    const position = this.nextPosition(
      input.targetProjectId,
      row.column as TaskDto["column"],
    );
    const timestamp = new Date().toISOString();
    const dto = this.db.transaction((tx) => {
      tx.update(tasks)
        .set({
          projectId: input.targetProjectId,
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
          field: "projectId",
          oldValue: row.projectId,
          newValue: input.targetProjectId,
          batchId: null,
          source: this.historySource(isMcp),
        })
        .run();
      const updated = tx.select().from(tasks).where(eq(tasks.id, taskId)).get();
      if (!updated) throw notFound("Task not found after update");
      return assembleTaskDto(tx as unknown as AppDb, updated);
    });

    // Archived tasks sit on no board, so neither board has anything to show.
    if (!row.archivedAt) {
      this.broadcast(`project:${row.projectId}`, {
        type: "task.deleted",
        payload: { id: taskId, projectId: row.projectId },
        transferred: true,
        actorId,
        isMcp,
      });
      this.broadcast(`project:${input.targetProjectId}`, {
        type: "task.created",
        payload: dto,
        actorId,
        isMcp,
      });
    }
    return dto;
  }
}
