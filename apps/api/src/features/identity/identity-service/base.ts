import type { UserDto } from "@kanban/shared";
import type { AppDb } from "../../../types.js";
import type { users } from "../../../db/schema/index.js";

export const REFRESH_TTL_DAYS = 7;
export const VERIFY_TTL_HOURS = 24;
export const RESET_TTL_HOURS = 1;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_DURATION_MINUTES = 15;

export function expiresAt(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

export function expiresAtHours(hours: number): string {
  const date = new Date();
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export function expiresAtMinutes(minutes: number): string {
  const date = new Date();
  date.setMinutes(date.getMinutes() + minutes);
  return date.toISOString();
}

export function expiresAtSeconds(seconds: number): string {
  const date = new Date();
  date.setSeconds(date.getSeconds() + seconds);
  return date.toISOString();
}

export function toUserDto(row: typeof users.$inferSelect): UserDto {
  return {
    id: row.id,
    email: row.email,
    displayName: row.displayName,
    emailVerified: row.emailVerified,
    totpEnabled: row.totpEnabled,
    maxOpenPanels: row.maxOpenPanels,
    enableNotifications: row.enableNotifications,
    maxNotifications: row.maxNotifications,
    notificationDuration: row.notificationDuration,
    createdAt: row.createdAt,
  };
}

export class IdentityBase {
  constructor(protected readonly db: AppDb) {}

  protected toUserDto(row: typeof users.$inferSelect): UserDto {
    return toUserDto(row);
  }
}
