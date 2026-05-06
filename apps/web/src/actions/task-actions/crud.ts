"use server";

import { revalidatePath } from "next/cache";
import { api, ApiError } from "../../lib/api";
import { Column, createLogger } from "@kanban/shared";
import type { TaskDto } from "@kanban/shared";
import { actionError, requireTaskActionToken } from "./utils";

const logger = createLogger("task-actions");

export async function createTaskAction(
  projectId: string,
  orgId: string,
  _prev: { error?: string; task?: TaskDto },
  formData: FormData,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await requireTaskActionToken();
  const title = formData.get("title") as string;
  const column = (formData.get("column") as Column) ?? Column.TODO;
  const startDate = formData.get("startDate") as string;
  const endDate = formData.get("endDate") as string;
  const description = (formData.get("description") as string) || null;
  const objective = (formData.get("objective") as string) || null;
  const tags = formData.getAll("tags") as string[];
  const bgRaw = formData.get("backgroundColor") as string | null;
  const backgroundColor = bgRaw && bgRaw !== "#ffffff" ? bgRaw : null;

  try {
    let { data: task } = await api.tasks.create(token, projectId, {
      title,
      column,
      startDate,
      endDate,
      description,
      objective,
      backgroundColor,
    });
    for (const tag of tags) {
      const res = await api.tasks.addTag(token, projectId, task.id, tag);
      task = res.data;
    }
    revalidatePath(`/orgs/${orgId}/projects/${projectId}`);
    return { task };
  } catch (error) {
    return { error: actionError(error, "Failed to create task") };
  }
}

export async function updateTaskAction(
  projectId: string,
  taskId: string,
  body: {
    title?: string;
    description?: string | null;
    objective?: string | null;
    startDate?: string;
    endDate?: string;
    doerId?: string | null;
    validatorId?: string | null;
    backgroundColor?: string | null;
    globalSubject?: string | null;
  },
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await requireTaskActionToken();
  try {
    const { data: task } = await api.tasks.update(
      token,
      projectId,
      taskId,
      body,
    );
    return { task };
  } catch (error) {
    return { error: actionError(error, "Failed to update task") };
  }
}

export async function deleteTaskAction(
  projectId: string,
  taskId: string,
): Promise<{ error?: string }> {
  const token = await requireTaskActionToken();
  logger.info(`[deleteTaskAction] Deleting task: ${taskId}`);
  try {
    await api.tasks.delete(token, projectId, taskId);
    logger.info(`[deleteTaskAction] Successfully deleted task: ${taskId}`);
    return {};
  } catch (error: unknown) {
    return logTaskActionFailure("deleteTaskAction", taskId, error);
  }
}

export async function importCsvAction(
  projectId: string,
  _prev: { error?: string; result?: { imported: number; skipped: number } },
  formData: FormData,
): Promise<{ error?: string; result?: { imported: number; skipped: number } }> {
  const token = await requireTaskActionToken();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Please select a CSV file" };
  }

  try {
    const { data: result } = await api.tasks.importCsv(token, projectId, file);
    revalidatePath(`/orgs/[orgId]/projects/${projectId}`);
    return { result };
  } catch (error) {
    return { error: actionError(error, "Import failed") };
  }
}

function logTaskActionFailure(
  actionName: string,
  taskId: string,
  error: unknown,
): { error: string } {
  if (error instanceof ApiError) {
    logger.error(
      `[${actionName}] API error (${error.status}) for task ${taskId}:`,
      error.message,
    );
    if (error.body) {
      logger.error(
        `[${actionName}] API response body:`,
        JSON.stringify(error.body),
      );
    }
    return { error: error.message };
  }
  const message =
    error instanceof Error ? error.message : "Failed to delete task";
  logger.error(`[${actionName}] Unexpected error for task ${taskId}:`, message);
  return { error: message };
}
