import type { Column, TaskDto, TaskHistoryDto } from "@kanban/shared";
import { apiFetch } from "./core";

export const tasksApi = {
  list(token: string, projectId: string) {
    return apiFetch<TaskDto[]>(`/projects/${projectId}/tasks`, { token });
  },
  create(
    token: string,
    projectId: string,
    body: {
      title: string;
      column: Column;
      startDate: string;
      endDate: string;
      description?: string | null;
      objective?: string | null;
      backgroundColor?: string | null;
    },
  ) {
    return apiFetch<TaskDto>(`/projects/${projectId}/tasks`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    });
  },
  update(
    token: string,
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
    },
  ) {
    return apiFetch<TaskDto>(`/projects/${projectId}/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(body),
      token,
    });
  },
  move(
    token: string,
    projectId: string,
    taskId: string,
    body: { column: Column },
  ) {
    return apiFetch<TaskDto>(`/projects/${projectId}/tasks/${taskId}/move`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    });
  },
  delete(token: string, projectId: string, taskId: string) {
    return apiFetch<{ success: true }>(
      `/projects/${projectId}/tasks/${taskId}`,
      { method: "DELETE", token },
    );
  },
  importCsv(token: string, projectId: string, file: File) {
    const form = new FormData();
    form.append("file", file);
    return apiFetch<{ imported: number; skipped: number }>(
      `/projects/${projectId}/import`,
      { method: "POST", token, body: form },
    );
  },
  archive(token: string, projectId: string, taskIds: string[]) {
    return apiFetch<{ success: true }>(`/projects/${projectId}/tasks/archive`, {
      method: "POST",
      token,
      body: JSON.stringify({ taskIds }),
    });
  },
  restore(token: string, projectId: string, taskId: string) {
    return apiFetch<TaskDto>(`/projects/${projectId}/tasks/${taskId}/restore`, {
      method: "POST",
      token,
    });
  },
  listArchived(
    token: string,
    projectId: string,
    opts: {
      search?: string;
      page?: number;
      dateFrom?: string;
      dateTo?: string;
    } = {},
  ) {
    const params = buildArchiveParams(opts);
    return apiFetch<{ tasks: TaskDto[]; total: number }>(
      `/projects/${projectId}/archived-tasks?${params}`,
      { token },
    );
  },
  getHistory(token: string, projectId: string, taskId: string) {
    return apiFetch<TaskHistoryDto[]>(
      `/projects/${projectId}/tasks/${taskId}/history`,
      { token },
    );
  },
  addTag(token: string, projectId: string, taskId: string, tag: string) {
    return apiFetch<TaskDto>(
      `/projects/${projectId}/tasks/${taskId}/tags/${encodeURIComponent(tag)}`,
      { method: "POST", token },
    );
  },
  removeTag(token: string, projectId: string, taskId: string, tag: string) {
    return apiFetch<TaskDto>(
      `/projects/${projectId}/tasks/${taskId}/tags/${encodeURIComponent(tag)}`,
      { method: "DELETE", token },
    );
  },
  addWatcher(token: string, projectId: string, taskId: string, userId: string) {
    return apiFetch<TaskDto>(
      `/projects/${projectId}/tasks/${taskId}/watchers/${userId}`,
      { method: "POST", token },
    );
  },
  removeWatcher(
    token: string,
    projectId: string,
    taskId: string,
    userId: string,
  ) {
    return apiFetch<TaskDto>(
      `/projects/${projectId}/tasks/${taskId}/watchers/${userId}`,
      { method: "DELETE", token },
    );
  },
  addAdvisor(token: string, projectId: string, taskId: string, userId: string) {
    return apiFetch<TaskDto>(
      `/projects/${projectId}/tasks/${taskId}/advisors/${userId}`,
      { method: "POST", token },
    );
  },
  removeAdvisor(
    token: string,
    projectId: string,
    taskId: string,
    userId: string,
  ) {
    return apiFetch<TaskDto>(
      `/projects/${projectId}/tasks/${taskId}/advisors/${userId}`,
      { method: "DELETE", token },
    );
  },
  addLink(
    token: string,
    projectId: string,
    taskId: string,
    linkedTaskId: string,
  ) {
    return apiFetch<TaskDto>(
      `/projects/${projectId}/tasks/${taskId}/links/${linkedTaskId}`,
      { method: "POST", token },
    );
  },
  removeLink(
    token: string,
    projectId: string,
    taskId: string,
    linkedTaskId: string,
  ) {
    return apiFetch<TaskDto>(
      `/projects/${projectId}/tasks/${taskId}/links/${linkedTaskId}`,
      { method: "DELETE", token },
    );
  },
  search(token: string, orgId: string, q: string) {
    return apiFetch<Array<TaskDto & { projectName: string }>>(
      `/projects/search/${orgId}?q=${encodeURIComponent(q)}`,
      { token },
    );
  },
  getById(token: string, taskId: string) {
    return apiFetch<TaskDto>(`/projects/by-id/${taskId}`, { token });
  },
};

export function buildArchiveParams(opts: {
  search?: string;
  page?: number;
  dateFrom?: string;
  dateTo?: string;
}) {
  const params = new URLSearchParams();
  if (opts.search) params.set("search", opts.search);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.dateFrom) params.set("dateFrom", opts.dateFrom);
  if (opts.dateTo) params.set("dateTo", opts.dateTo);
  return params;
}
