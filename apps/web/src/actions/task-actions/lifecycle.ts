"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "../../lib/api";
import { createLogger } from "@kanban/shared";
import type { TaskDto , Column} from "@kanban/shared";
import { actionError, requireTaskActionToken } from "./utils";

const logger = createLogger("task-actions");

export async function archiveTasksAction(
  projectId: string,
  taskIds: string[],
): Promise<{ error?: string }> {
  const token = await requireTaskActionToken();
  try {
    await api.tasks.archive(token, projectId, taskIds);
    return {};
  } catch (error) {
    return { error: actionError(error, "Failed to archive tasks") };
  }
}

export async function restoreTaskAction(
  projectId: string,
  taskId: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await requireTaskActionToken();
  logger.info(`[restoreTaskAction] Restoring task: ${taskId}`);
  try {
    const { data: task } = await api.tasks.restore(token, projectId, taskId);
    logger.info(`[restoreTaskAction] Successfully restored task: ${taskId}`);
    revalidatePath(`/orgs/[orgId]/projects/${projectId}`, "page");
    return { task };
  } catch (error: unknown) {
    return logRestoreFailure(taskId, error);
  }
}

export async function moveTaskAction(
  projectId: string,
  taskId: string,
  column: Column,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await requireTaskActionToken();
  try {
    const { data: task } = await api.tasks.move(token, projectId, taskId, {
      column,
    });
    return { task };
  } catch (error) {
    return { error: actionError(error, "Failed to move task") };
  }
}

export async function searchTasksInOrgAction(
  orgId: string,
  query: string,
): Promise<{
  error?: string;
  tasks?: Array<TaskDto & { projectName: string }>;
}> {
  const token = await requireTaskActionToken();
  try {
    const { data: tasks } = await api.tasks.search(token, orgId, query);
    return { tasks };
  } catch (error) {
    return { error: actionError(error, "Failed to search tasks") };
  }
}

export async function getTaskByIdAction(
  taskId: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await requireTaskActionToken();
  try {
    const { data: task } = await api.tasks.getById(token, taskId);
    return { task };
  } catch (error) {
    return { error: actionError(error, "Failed to load task") };
  }
}

function logRestoreFailure(taskId: string, error: unknown): { error: string } {
  if (error instanceof ApiError) {
    logger.error(
      `[restoreTaskAction] API error (${error.status}) for task ${taskId}:`,
      error.message,
    );
    if (error.body) {
      logger.error(
        `[restoreTaskAction] API response body:`,
        JSON.stringify(error.body),
      );
    }
    return { error: error.message };
  }
  const message =
    error instanceof Error ? error.message : "Failed to restore task";
  logger.error(
    `[restoreTaskAction] Unexpected error for task ${taskId}:`,
    message,
  );
  return { error: message };
}
