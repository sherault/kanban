"use server";

import { api } from "../../lib/api";
import type { TaskDto, TaskHistoryDto } from "@kanban/shared";
import { actionError, requireTaskActionToken } from "./utils";

export async function getTaskHistoryAction(
  projectId: string,
  taskId: string,
): Promise<{ history?: TaskHistoryDto[]; error?: string }> {
  const token = await requireTaskActionToken();
  try {
    const { data: history } = await api.tasks.getHistory(
      token,
      projectId,
      taskId,
    );
    return { history };
  } catch (error) {
    return { error: actionError(error, "Failed to load history") };
  }
}

export async function addTagAction(
  projectId: string,
  taskId: string,
  tag: string,
) {
  return mutateTask(
    (token) => api.tasks.addTag(token, projectId, taskId, tag),
    "Failed to add tag",
  );
}

export async function removeTagAction(
  projectId: string,
  taskId: string,
  tag: string,
) {
  return mutateTask(
    (token) => api.tasks.removeTag(token, projectId, taskId, tag),
    "Failed to remove tag",
  );
}

export async function addWatcherAction(
  projectId: string,
  taskId: string,
  userId: string,
) {
  return mutateTask(
    (token) => api.tasks.addWatcher(token, projectId, taskId, userId),
    "Failed to add watcher",
  );
}

export async function removeWatcherAction(
  projectId: string,
  taskId: string,
  userId: string,
) {
  return mutateTask(
    (token) => api.tasks.removeWatcher(token, projectId, taskId, userId),
    "Failed to remove watcher",
  );
}

export async function addAdvisorAction(
  projectId: string,
  taskId: string,
  userId: string,
) {
  return mutateTask(
    (token) => api.tasks.addAdvisor(token, projectId, taskId, userId),
    "Failed to add advisor",
  );
}

export async function removeAdvisorAction(
  projectId: string,
  taskId: string,
  userId: string,
) {
  return mutateTask(
    (token) => api.tasks.removeAdvisor(token, projectId, taskId, userId),
    "Failed to remove advisor",
  );
}

export async function addLinkAction(
  projectId: string,
  taskId: string,
  linkedTaskId: string,
) {
  return mutateTask(
    (token) => api.tasks.addLink(token, projectId, taskId, linkedTaskId),
    "Failed to add link",
  );
}

export async function removeLinkAction(
  projectId: string,
  taskId: string,
  linkedTaskId: string,
) {
  return mutateTask(
    (token) => api.tasks.removeLink(token, projectId, taskId, linkedTaskId),
    "Failed to remove link",
  );
}

async function mutateTask(
  request: (token: string) => Promise<{ data: TaskDto }>,
  fallback: string,
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await requireTaskActionToken();
  try {
    const { data: task } = await request(token);
    return { task };
  } catch (error) {
    return { error: actionError(error, fallback) };
  }
}
