import type {
  UserDto,
  OrganizationDto,
  MembershipDto,
  InvitationTokenDto,
  ProjectDto,
  TaskDto,
  TaskHistoryDto,
  ApiKeyDto,
  ApiKeyCreatedDto,
  Column,
} from "@kanban/shared";

const API_URL = process.env["API_URL"] ?? "http://localhost:3010";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface FetchOptions extends RequestInit {
  token?: string;
  refreshToken?: string;
}

async function apiFetch<T>(
  path: string,
  { token, refreshToken, ...init }: FetchOptions = {},
): Promise<{ data: T; headers: Headers }> {
  const headers: Record<string, string> = {
    // Don't set Content-Type for FormData — browser sets it with boundary automatically
    ...(init.body && !(init.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(refreshToken ? { Cookie: `refresh_token=${refreshToken}` } : {}),
  };

  const res = await fetch(`${API_URL}${path}`, { ...init, headers });

  if (!res.ok) {
    const payload = (await res
      .json()
      .catch(() => ({ error: "Request failed" }))) as { error?: string };
    throw new ApiError(res.status, payload.error ?? "Request failed");
  }

  const data = (await res.json()) as T;
  return { data, headers: res.headers };
}

export const api = {
  auth: {
    register(body: { email: string; password: string; displayName: string }) {
      return apiFetch<{ user: UserDto }>("/auth/register", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    login(body: { email: string; password: string }) {
      return apiFetch<{ user: UserDto; accessToken: string }>("/auth/login", {
        method: "POST",
        body: JSON.stringify(body),
      });
    },
    refresh(refreshToken: string) {
      return apiFetch<{ accessToken: string }>("/auth/refresh", {
        method: "POST",
        refreshToken,
      });
    },
    logout(token: string, refreshToken: string) {
      return apiFetch<{ success: true }>("/auth/logout", {
        method: "POST",
        token,
        refreshToken,
      });
    },
  },

  orgs: {
    list(token: string) {
      return apiFetch<OrganizationDto[]>("/organizations", { token });
    },
    create(token: string, body: { name: string; website?: string | null }) {
      return apiFetch<OrganizationDto>("/organizations", {
        method: "POST",
        body: JSON.stringify(body),
        token,
      });
    },
    listMembers(token: string, orgId: string) {
      return apiFetch<MembershipDto[]>(`/organizations/${orgId}/members`, {
        token,
      });
    },
    createInvitation(token: string, orgId: string) {
      return apiFetch<InvitationTokenDto & { rawToken: string }>(
        `/organizations/${orgId}/invitations`,
        { method: "POST", token },
      );
    },
  },

  projects: {
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
  },

  tasks: {
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
        tags?: string[];
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
        {
          method: "DELETE",
          token,
        },
      );
    },
    importCsv(token: string, projectId: string, file: File) {
      const form = new FormData();
      form.append("file", file);
      return apiFetch<{ imported: number; skipped: number }>(
        `/projects/${projectId}/import`,
        {
          method: "POST",
          token,
          body: form,
        },
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
    addWatcher(
      token: string,
      projectId: string,
      taskId: string,
      userId: string,
    ) {
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
    addAdvisor(
      token: string,
      projectId: string,
      taskId: string,
      userId: string,
    ) {
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
  },

  profile: {
    listKeys(token: string) {
      return apiFetch<ApiKeyDto[]>("/profile/api-keys", { token });
    },
    createKey(token: string, label: string) {
      return apiFetch<ApiKeyCreatedDto>("/profile/api-keys", {
        method: "POST",
        token,
        body: JSON.stringify({ label }),
      });
    },
    revokeKey(token: string, keyId: string) {
      return apiFetch<{ success: true }>(`/profile/api-keys/${keyId}`, {
        method: "DELETE",
        token,
      });
    },
  },

  invite: {
    get(rawToken: string) {
      return apiFetch<{ organization: { id: string; name: string } }>(
        `/invite/${rawToken}`,
      );
    },
    accept(
      rawToken: string,
      body: { email: string; password: string; displayName: string },
    ) {
      return apiFetch<{ user: UserDto; accessToken: string }>(
        `/invite/${rawToken}`,
        {
          method: "POST",
          body: JSON.stringify(body),
        },
      );
    },
  },
};
