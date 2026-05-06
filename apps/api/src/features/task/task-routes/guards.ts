import type { TaskDto } from "@kanban/shared";
import { notFound } from "../../../lib/errors.js";
import type { TaskService } from "../task.service.js";

export function assertProjectTask(
  svc: TaskService,
  projectId: string,
  taskId: string,
): TaskDto {
  const task = svc.getTask(taskId);
  if (!task || task.projectId !== projectId) {
    throw notFound("Task not found");
  }
  return task;
}
