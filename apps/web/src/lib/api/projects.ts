import type { ProjectDto } from "@kanban/shared";
import { apiFetch } from "./core";

export const projectsApi = {
  list(token: string, orgId: string) {
    return apiFetch<ProjectDto[]>(`/organizations/${orgId}/projects`, {
      token,
    });
  },
  create(token: string, orgId: string, body: { name: string }) {
    return apiFetch<ProjectDto>(`/organizations/${orgId}/projects`, {
      method: "POST",
      body: JSON.stringify(body),
      token,
    });
  },
  update(
    token: string,
    orgId: string,
    projectId: string,
    body: { name: string },
  ) {
    return apiFetch<ProjectDto>(
      `/organizations/${orgId}/projects/${projectId}`,
      { method: "PATCH", body: JSON.stringify(body), token },
    );
  },
  delete(token: string, orgId: string, projectId: string) {
    return apiFetch<{ success: true }>(
      `/organizations/${orgId}/projects/${projectId}`,
      { method: "DELETE", token },
    );
  },
};
