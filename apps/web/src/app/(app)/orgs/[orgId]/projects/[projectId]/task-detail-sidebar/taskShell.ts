import type { TaskDto } from "@kanban/shared";
import type { TaskDetailShell } from "./types";

/**
 * A panel restored from `kanban_open_tasks_<orgId>` can reference a task that
 * is not part of the current project's board (typically a task belonging to
 * another project of the same org). In that case the sidebar only receives a
 * `{ taskId }` placeholder, which must never be treated as a `TaskDto` — the
 * real task has to be fetched first.
 */
export function resolveTaskShell(initialTask: TaskDetailShell): {
  isShell: boolean;
  initialId: string | undefined;
  initialTaskDto: TaskDto | null;
} {
  const shellTaskId = "taskId" in initialTask ? initialTask.taskId : undefined;
  const isShell = !initialTask.id && !!shellTaskId;
  return {
    isShell,
    initialId: initialTask.id || shellTaskId,
    initialTaskDto: isShell ? null : (initialTask as TaskDto),
  };
}
