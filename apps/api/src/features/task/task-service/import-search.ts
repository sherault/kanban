import { and, eq, isNull, like, max, or } from "drizzle-orm";
import type { TaskDto } from "@kanban/shared";
import { generateId } from "../../../lib/id.js";
import { unprocessable } from "../../../lib/errors.js";
import { projects, tasks } from "../../../db/schema/index.js";
import { parseCsvImport } from "../csv-import.js";
import { TaskServiceBase } from "./base.js";

export class TaskImportSearchOperations extends TaskServiceBase {
  importTasks(
    projectId: string,
    reporterId: string,
    csvText: string,
  ): { imported: number; skipped: number } {
    let parseResult: ReturnType<typeof parseCsvImport>;
    try {
      parseResult = parseCsvImport(csvText);
    } catch (error) {
      throw unprocessable(
        error instanceof Error ? error.message : "Invalid CSV",
      );
    }
    const { valid, skipped } = parseResult;
    const imported = this.db.transaction((tx) => {
      let count = 0;
      for (const row of valid) {
        const maxResult = tx
          .select({ pos: max(tasks.position) })
          .from(tasks)
          .where(
            and(eq(tasks.projectId, projectId), eq(tasks.column, row.column)),
          )
          .get();
        const position = (maxResult?.pos ?? 0) + 1;
        tx.insert(tasks)
          .values({
            id: generateId(),
            projectId,
            reporterId,
            column: row.column,
            title: row.title,
            description: row.description,
            objective: row.objective,
            startDate: row.startDate,
            endDate: row.endDate,
            backgroundColor: row.backgroundColor,
            globalSubject: row.globalSubject,
            doerId: null,
            validatorId: null,
            position,
          })
          .run();
        count++;
      }
      return count;
    });

    return { imported, skipped };
  }

  searchTasksInOrg(
    orgId: string,
    query: string,
    limit: number = 20,
  ): Array<TaskDto & { projectName: string }> {
    const rows = this.db
      .select({ task: tasks, projectName: projects.name })
      .from(tasks)
      .innerJoin(projects, eq(tasks.projectId, projects.id))
      .where(
        and(
          eq(projects.organizationId, orgId),
          isNull(tasks.archivedAt),
          or(like(tasks.title, `%${query}%`), eq(tasks.id, query)),
        ),
      )
      .limit(limit)
      .all();

    return rows.map((row) => ({
      ...this.assemble(row.task),
      projectName: row.projectName,
    }));
  }

  getTaskGlobal(taskId: string): TaskDto | undefined {
    const row = this.db.select().from(tasks).where(eq(tasks.id, taskId)).get();
    return row ? this.assemble(row) : undefined;
  }
}
