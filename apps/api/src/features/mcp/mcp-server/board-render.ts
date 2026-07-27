import type { TaskDto } from "@kanban/shared";
import { COLUMN_VALUES } from "./utils.js";

export const DEFAULT_LIMIT_PER_COLUMN = 50;

function renderTask(task: TaskDto): string {
  const parts = [`- [${task.id}] ${task.title}`];
  if (task.doer) parts.push(`[@${task.doer.displayName}]`);
  parts.push(`due:${task.endDate.slice(0, 10)}`);
  if (task.tags.length) parts.push(task.tags.map((tag) => `#${tag}`).join(" "));
  if (task.backgroundColor) parts.push(`^${task.backgroundColor}`);
  return parts.join(" ");
}

/**
 * Renders a project board as compact text: one section per column, one line per
 * task. Shared by the get_board tool and the kanban://projects/{id}/board resource.
 */
export function renderBoard(
  tasks: TaskDto[],
  projectId: string,
  limitPerColumn: number,
): string {
  const lines: string[] = [`Board: project ${projectId}`, ""];

  for (const column of COLUMN_VALUES) {
    const columnTasks = tasks
      .filter((task) => task.column === column)
      .sort(
        (left, right) =>
          left.position - right.position || left.id.localeCompare(right.id),
      );

    lines.push(`## ${column.toUpperCase()} (${columnTasks.length})`);
    for (const task of columnTasks.slice(0, limitPerColumn)) {
      lines.push(renderTask(task));
    }

    const hidden = columnTasks.length - limitPerColumn;
    if (hidden > 0) lines.push(`- … ${hidden} more (use list_tasks)`);

    lines.push("");
  }

  return lines.join("\n");
}
