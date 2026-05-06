import type { ApiKeyCreatedDto, ApiKeyDto } from "@kanban/shared";
import { apiFetch } from "./core";

export const profileApi = {
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
};
