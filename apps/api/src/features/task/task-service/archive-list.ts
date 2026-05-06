import { and, asc, eq, isNotNull, sql } from "drizzle-orm";
import type { TaskDto } from "@kanban/shared";
import { tasks } from "../../../db/schema/index.js";
import { TaskServiceBase } from "./base.js";

export interface ArchivedTaskListOptions {
  search?: string;
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

export class TaskArchiveListOperations extends TaskServiceBase {
  listArchivedTasks(
    projectId: string,
    opts: ArchivedTaskListOptions = {},
  ): { tasks: TaskDto[]; total: number } {
    const { search, page = 1, limit = 20, dateFrom, dateTo } = opts;
    const conditions = [
      eq(tasks.projectId, projectId),
      isNotNull(tasks.archivedAt),
      ...(dateFrom ? [sql`${tasks.archivedAt} >= ${dateFrom}`] : []),
      ...(dateTo ? [sql`${tasks.archivedAt} <= ${dateTo}`] : []),
    ];

    const rows = this.db
      .select()
      .from(tasks)
      .where(and(...conditions))
      .orderBy(asc(tasks.endDate))
      .all();
    let allDtos = rows.map((row) => this.assemble(row));

    if (search) {
      const query = search.toLowerCase();
      allDtos = allDtos.filter((dto) => archivedTaskMatches(dto, query));
    }

    const total = allDtos.length;
    const offset = (page - 1) * limit;
    return { tasks: allDtos.slice(offset, offset + limit), total };
  }
}

export function archivedTaskMatches(dto: TaskDto, query: string) {
  const userNames = [
    dto.doer?.displayName,
    dto.validator?.displayName,
    dto.reporter?.displayName,
    ...(dto.watchers ?? []).map((watcher) => watcher.displayName),
    ...(dto.advisors ?? []).map((advisor) => advisor.displayName),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  const tagStr = dto.tags.join(" ").toLowerCase();

  return (
    dto.title.toLowerCase().includes(query) ||
    (dto.description ?? "").toLowerCase().includes(query) ||
    (dto.objective ?? "").toLowerCase().includes(query) ||
    (dto.globalSubject ?? "").toLowerCase().includes(query) ||
    tagStr.includes(query) ||
    userNames.includes(query)
  );
}
