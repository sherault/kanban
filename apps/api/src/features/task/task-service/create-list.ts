import { and, asc, eq, isNull, like, or } from "drizzle-orm";
import type { Column, TaskDto } from "@kanban/shared";
import { generateId } from "../../../lib/id.js";
import { tasks, taskTags } from "../../../db/schema/index.js";
import { TaskServiceBase } from "./base.js";

export interface CreateTaskInput {
  title: string;
  description?: string | null | undefined;
  objective?: string | null | undefined;
  startDate: string;
  endDate: string;
  backgroundColor?: string | null | undefined;
  globalSubject?: string | null | undefined;
  column?: Column | undefined;
  doerId?: string | null | undefined;
  validatorId?: string | null | undefined;
  tags?: string[] | undefined;
}

export class TaskCreateListOperations extends TaskServiceBase {
  createTask(
    projectId: string,
    reporterId: string,
    input: CreateTaskInput,
    isMcp?: boolean,
  ): TaskDto {
    const column: Column = input.column ?? "todo";
    const id = generateId();
    const position = this.nextPosition(projectId, column);
    const row = this.db
      .insert(tasks)
      .values({
        id,
        projectId,
        reporterId,
        column,
        title: input.title,
        description: input.description ?? null,
        objective: input.objective ?? null,
        startDate: input.startDate,
        endDate: input.endDate,
        backgroundColor: input.backgroundColor ?? null,
        globalSubject: input.globalSubject ?? null,
        doerId: input.doerId ?? null,
        validatorId: input.validatorId ?? null,
        position,
      })
      .returning()
      .get();
    if (!row) throw new Error("Failed to create task");

    for (const tag of input.tags ?? []) {
      this.db.insert(taskTags).values({ taskId: id, tag }).run();
    }

    const dto = this.assemble(row);
    this.broadcast(`project:${projectId}`, {
      type: "task.created",
      payload: dto,
      actorId: reporterId,
      isMcp,
    });
    return dto;
  }

  getTask(taskId: string): TaskDto | undefined {
    const row = this.db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    return row ? this.assemble(row) : undefined;
  }

  listTasks(
    projectId: string,
    options: { search?: string | undefined } = {},
  ): TaskDto[] {
    const conditions = [
      eq(tasks.projectId, projectId),
      isNull(tasks.archivedAt),
    ];

    if (options.search) {
      conditions.push(
        or(
          like(tasks.title, `%${options.search}%`),
          like(tasks.description, `%${options.search}%`),
          like(tasks.globalSubject, `%${options.search}%`),
          like(tasks.objective, `%${options.search}%`),
        )!,
      );
    }

    const rows = this.db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(asc(tasks.endDate))
      .all();

    return rows.map((row) => this.assemble(row));
  }
}
