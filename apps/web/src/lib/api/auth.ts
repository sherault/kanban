import type { UserDto } from "@kanban/shared";
import { apiFetch } from "./core";

export const authApi = {
  register(body: { email: string; password: string; displayName: string }) {
    return apiFetch<{ user: UserDto }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  login(body: { email: string; password: string; totpCode?: string }) {
    return apiFetch<
      { user: UserDto; accessToken: string } | { totpRequired: true }
    >("/auth/login", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  verifyEmail(token: string) {
    return apiFetch<{ success: true }>(
      `/auth/verify-email?token=${encodeURIComponent(token)}`,
    );
  },
  resendVerification(token: string) {
    return apiFetch<{ success: true }>("/auth/resend-verification", {
      method: "POST",
      token,
    });
  },
  forgotPassword(body: { email: string }) {
    return apiFetch<{ success: true }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  resetPassword(body: { token: string; password: string }) {
    return apiFetch<{ success: true }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  resendVerificationPublic(body: { email: string }) {
    return apiFetch<{ success: true }>("/auth/resend-verification-public", {
      method: "POST",
      body: JSON.stringify(body),
    });
  },
  me(token: string) {
    return apiFetch<UserDto>("/auth/me", { token });
  },
  setupTotp(token: string) {
    return apiFetch<{ secret: string; uri: string; qrCode: string }>(
      "/auth/totp/setup",
      { method: "POST", token },
    );
  },
  enableTotp(token: string, code: string) {
    return apiFetch<{ success: true }>("/auth/totp/enable", {
      method: "POST",
      body: JSON.stringify({ code }),
      token,
    });
  },
  disableTotp(token: string, code: string) {
    return apiFetch<{ success: true }>("/auth/totp", {
      method: "DELETE",
      body: JSON.stringify({ code }),
      token,
    });
  },
  updateSettings(
    token: string,
    body: {
      maxOpenPanels?: number;
      enableNotifications?: boolean;
      maxNotifications?: number;
      notificationDuration?: number;
    },
  ) {
    return apiFetch<{ user: UserDto }>("/auth/me/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
      token,
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
};
