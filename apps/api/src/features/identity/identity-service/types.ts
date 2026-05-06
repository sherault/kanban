import type { UserDto } from "@kanban/shared";

export interface RegisterInput {
  email: string;
  password: string;
  displayName: string;
}

export interface LoginInput {
  email: string;
  password: string;
  totpCode?: string;
}

export interface LoginResult {
  user: UserDto;
  accessToken: string;
  refreshToken: string;
}

export interface RefreshResult {
  accessToken: string;
  newRefreshToken: string;
}

export interface TotpSetupResult {
  secret: string;
  uri: string;
  qrCode: string;
}

export interface UserSettingsInput {
  maxOpenPanels?: number | undefined;
  enableNotifications?: boolean | undefined;
  maxNotifications?: number | undefined;
  notificationDuration?: number | undefined;
}
