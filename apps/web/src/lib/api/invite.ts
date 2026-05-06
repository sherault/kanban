import type { UserDto } from "@kanban/shared";
import { apiFetch } from "./core";

export const inviteApi = {
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
      { method: "POST", body: JSON.stringify(body) },
    );
  },
};
