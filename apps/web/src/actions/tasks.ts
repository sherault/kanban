"use server";

import type { Column, TaskDto, TaskHistoryDto } from "@kanban/shared";
import {
  createTaskAction as createTask,
  deleteTaskAction as deleteTask,
  importCsvAction as importCsv,
  updateTaskAction as updateTask,
} from "./task-actions/crud";
import {
  archiveTasksAction as archiveTasks,
  getTaskByIdAction as getTaskById,
  moveTaskAction as moveTask,
  restoreTaskAction as restoreTask,
  searchTasksInOrgAction as searchTasksInOrg,
} from "./task-actions/lifecycle";
import {
  addAdvisorAction as addAdvisor,
  addLinkAction as addLink,
  addTagAction as addTag,
  addWatcherAction as addWatcher,
  getTaskHistoryAction as getTaskHistory,
  removeAdvisorAction as removeAdvisor,
  removeLinkAction as removeLink,
  removeTagAction as removeTag,
  removeWatcherAction as removeWatcher,
} from "./task-actions/relations";

type TaskUpdateBody = {
  title?: string;
  description?: string | null;
  objective?: string | null;
  startDate?: string;
  endDate?: string;
  doerId?: string | null;
  validatorId?: string | null;
  backgroundColor?: string | null;
  globalSubject?: string | null;
};

export async function createTaskAction(
  projectId: string,
  orgId: string,
  prev: { error?: string; task?: TaskDto },
  formData: FormData,
): Promise<{ error?: string; task?: TaskDto }> {
  return createTask(projectId, orgId, prev, formData);
}

export async function updateTaskAction(
  projectId: string,
  taskId: string,
  body: TaskUpdateBody,
): Promise<{ error?: string; task?: TaskDto }> {
  return updateTask(projectId, taskId, body);
}

export async function deleteTaskAction(
  projectId: string,
  taskId: string,
): Promise<{ error?: string }> {
  return deleteTask(projectId, taskId);
}

export async function importCsvAction(
  projectId: string,
  prev: { error?: string; result?: { imported: number; skipped: number } },
  formData: FormData,
): Promise<{ error?: string; result?: { imported: number; skipped: number } }> {
  return importCsv(projectId, prev, formData);
}

export async function archiveTasksAction(
  projectId: string,
  taskIds: string[],
): Promise<{ error?: string }> {
  return archiveTasks(projectId, taskIds);
}

export async function restoreTaskAction(
  projectId: string,
  taskId: string,
): Promise<{ error?: string; task?: TaskDto }> {
  return restoreTask(projectId, taskId);
}

export async function moveTaskAction(
  projectId: string,
  taskId: string,
  column: Column,
): Promise<{ error?: string; task?: TaskDto }> {
  return moveTask(projectId, taskId, column);
}

export async function searchTasksInOrgAction(
  orgId: string,
  query: string,
): Promise<{
  error?: string;
  tasks?: Array<TaskDto & { projectName: string }>;
}> {
  return searchTasksInOrg(orgId, query);
}

export async function getTaskByIdAction(
  taskId: string,
): Promise<{ error?: string; task?: TaskDto }> {
  return getTaskById(taskId);
}

export async function getTaskHistoryAction(
  projectId: string,
  taskId: string,
): Promise<{ history?: TaskHistoryDto[]; error?: string }> {
  return getTaskHistory(projectId, taskId);
}

export async function addTagAction(
  projectId: string,
  taskId: string,
  tag: string,
) {
  return addTag(projectId, taskId, tag);
}

export async function removeTagAction(
  projectId: string,
  taskId: string,
  tag: string,
) {
  return removeTag(projectId, taskId, tag);
}

export async function addWatcherAction(
  projectId: string,
  taskId: string,
  userId: string,
) {
  return addWatcher(projectId, taskId, userId);
}

export async function removeWatcherAction(
  projectId: string,
  taskId: string,
  userId: string,
) {
  return removeWatcher(projectId, taskId, userId);
}

export async function addAdvisorAction(
  projectId: string,
  taskId: string,
  userId: string,
) {
  return addAdvisor(projectId, taskId, userId);
}

export async function removeAdvisorAction(
  projectId: string,
  taskId: string,
  userId: string,
) {
  return removeAdvisor(projectId, taskId, userId);
}

export async function addLinkAction(
  projectId: string,
  taskId: string,
  linkedTaskId: string,
) {
  return addLink(projectId, taskId, linkedTaskId);
}

export async function removeLinkAction(
  projectId: string,
  taskId: string,
  linkedTaskId: string,
) {
  return removeLink(projectId, taskId, linkedTaskId);
}
