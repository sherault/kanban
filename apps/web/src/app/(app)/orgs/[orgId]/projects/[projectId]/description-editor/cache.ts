import { getTaskByIdAction } from "@/actions/tasks";
import { getWikiPageAction } from "@/actions/wiki";
import type { TaskDto, WikiPageDto } from "@kanban/shared";

const taskCache = new Map<string, TaskDto>();
const pendingTaskRequests = new Map<
  string,
  Promise<{ task?: TaskDto; error?: string }>
>();

export async function getTaskCached(taskId: string) {
  if (taskCache.has(taskId)) return { task: taskCache.get(taskId) };
  if (pendingTaskRequests.has(taskId)) return pendingTaskRequests.get(taskId);

  const request = getTaskByIdAction(taskId).then((res) => {
    if (res.task) taskCache.set(taskId, res.task);
    pendingTaskRequests.delete(taskId);
    return res;
  });

  pendingTaskRequests.set(taskId, request);
  return request;
}

const wikiCache = new Map<string, WikiPageDto>();
const pendingWikiRequests = new Map<
  string,
  Promise<{ page?: WikiPageDto; error?: string }>
>();

export async function getWikiCached(pageId: string) {
  if (wikiCache.has(pageId)) return { page: wikiCache.get(pageId) };
  if (pendingWikiRequests.has(pageId)) return pendingWikiRequests.get(pageId);

  const request = getWikiPageAction(pageId).then((res) => {
    if (res.page) wikiCache.set(pageId, res.page);
    pendingWikiRequests.delete(pageId);
    return res;
  });

  pendingWikiRequests.set(pageId, request);
  return request;
}
