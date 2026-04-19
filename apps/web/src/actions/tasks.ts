"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, ApiError } from "../lib/api";
import { getAccessToken } from "../lib/session";
import { Column, createLogger } from "@kanban/shared";
import type { TaskDto, TaskHistoryDto } from "@kanban/shared";

const logger = createLogger("task-actions");

export async function createTaskAction(
  projectId: string,
  orgId: string,
  _prev: { error?: string; task?: TaskDto },
  formData: FormData,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

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
    // Tags are managed separately — add each after creation
    for (const tag of tags) {
      const res = await api.tasks.addTag(token, projectId, task.id, tag);
      task = res.data;
    }
    revalidatePath(`/orgs/${orgId}/projects/${projectId}`);
    return { task };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to create task",
    };
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
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: task } = await api.tasks.update(
      token,
      projectId,
      taskId,
      body,
    );
    return { task };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to update task",
    };
  }
}

export async function deleteTaskAction(
  projectId: string,
  taskId: string,
): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  logger.info(`[deleteTaskAction] Deleting task: ${taskId}`);
  try {
    await api.tasks.delete(token, projectId, taskId);
    logger.info(`[deleteTaskAction] Successfully deleted task: ${taskId}`);
    return {};
  } catch (e: unknown) {
    if (e instanceof ApiError) {
      logger.error(
        `[deleteTaskAction] API error (${e.status}) for task ${taskId}:`,
        e.message,
      );
      if (e.body)
        logger.error(
          `[deleteTaskAction] API response body:`,
          JSON.stringify(e.body),
        );
      return { error: e.message };
    }
    const error = e instanceof Error ? e.message : "Failed to delete task";
    logger.error(
      `[deleteTaskAction] Unexpected error for task ${taskId}:`,
      error,
    );
    return { error };
  }
}

export async function importCsvAction(
  projectId: string,
  _prev: { error?: string; result?: { imported: number; skipped: number } },
  formData: FormData,
): Promise<{ error?: string; result?: { imported: number; skipped: number } }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0)
    return { error: "Please select a CSV file" };

  try {
    const { data: result } = await api.tasks.importCsv(token, projectId, file);
    revalidatePath(`/orgs/[orgId]/projects/${projectId}`);
    return { result };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Import failed" };
  }
}

export async function getTaskHistoryAction(
  projectId: string,
  taskId: string,
): Promise<{ history?: TaskHistoryDto[]; error?: string }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: history } = await api.tasks.getHistory(
      token,
      projectId,
      taskId,
    );
    return { history };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to load history",
    };
  }
}

export async function addTagAction(
  projectId: string,
  taskId: string,
  tag: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: task } = await api.tasks.addTag(
      token,
      projectId,
      taskId,
      tag,
    );
    return { task };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to add tag" };
  }
}

export async function removeTagAction(
  projectId: string,
  taskId: string,
  tag: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: task } = await api.tasks.removeTag(
      token,
      projectId,
      taskId,
      tag,
    );
    return { task };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to remove tag",
    };
  }
}

export async function addWatcherAction(
  projectId: string,
  taskId: string,
  userId: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: task } = await api.tasks.addWatcher(
      token,
      projectId,
      taskId,
      userId,
    );
    return { task };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to add watcher",
    };
  }
}

export async function removeWatcherAction(
  projectId: string,
  taskId: string,
  userId: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: task } = await api.tasks.removeWatcher(
      token,
      projectId,
      taskId,
      userId,
    );
    return { task };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to remove watcher",
    };
  }
}

export async function addAdvisorAction(
  projectId: string,
  taskId: string,
  userId: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: task } = await api.tasks.addAdvisor(
      token,
      projectId,
      taskId,
      userId,
    );
    return { task };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to add advisor",
    };
  }
}

export async function removeAdvisorAction(
  projectId: string,
  taskId: string,
  userId: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: task } = await api.tasks.removeAdvisor(
      token,
      projectId,
      taskId,
      userId,
    );
    return { task };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to remove advisor",
    };
  }
}

export async function archiveTasksAction(
  projectId: string,
  taskIds: string[],
): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  try {
    await api.tasks.archive(token, projectId, taskIds);
    return {};
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to archive tasks",
    };
  }
}

export async function restoreTaskAction(
  projectId: string,
  taskId: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  logger.info(`[restoreTaskAction] Restoring task: ${taskId}`);
  try {
    const { data: task } = await api.tasks.restore(token, projectId, taskId);
    logger.info(`[restoreTaskAction] Successfully restored task: ${taskId}`);
    revalidatePath(`/orgs/[orgId]/projects/${projectId}`, "page");
    return { task };
  } catch (e: unknown) {
    if (e instanceof ApiError) {
      logger.error(
        `[restoreTaskAction] API error (${e.status}) for task ${taskId}:`,
        e.message,
      );
      if (e.body)
        logger.error(
          `[restoreTaskAction] API response body:`,
          JSON.stringify(e.body),
        );
      return { error: e.message };
    }
    const error = e instanceof Error ? e.message : "Failed to restore task";
    logger.error(
      `[restoreTaskAction] Unexpected error for task ${taskId}:`,
      error,
    );
    return { error };
  }
}

export async function moveTaskAction(
  projectId: string,
  taskId: string,
  column: Column,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: task } = await api.tasks.move(token, projectId, taskId, {
      column,
    });
    return { task };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to move task" };
  }
}

export async function addLinkAction(
  projectId: string,
  taskId: string,
  linkedTaskId: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: task } = await api.tasks.addLink(
      token,
      projectId,
      taskId,
      linkedTaskId,
    );
    return { task };
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : "Failed to add link" };
  }
}

export async function removeLinkAction(
  projectId: string,
  taskId: string,
  linkedTaskId: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: task } = await api.tasks.removeLink(
      token,
      projectId,
      taskId,
      linkedTaskId,
    );
    return { task };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to remove link",
    };
  }
}

export async function searchTasksInOrgAction(
  orgId: string,
  query: string,
): Promise<{
  error?: string;
  tasks?: Array<TaskDto & { projectName: string }>;
}> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: tasks } = await api.tasks.search(token, orgId, query);
    return { tasks };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to search tasks",
    };
  }
}

export async function getTaskByIdAction(
  taskId: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    const { data: task } = await api.tasks.getById(token, taskId);
    return { task };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to load task",
    };
  }
}
