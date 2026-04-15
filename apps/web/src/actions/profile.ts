"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { api, ApiError } from "../lib/api";
import { getAccessToken } from "../lib/session";
import type { ApiKeyCreatedDto } from "@kanban/shared";

export async function setupTotpAction(): Promise<{
  error?: string;
  secret?: string;
  qrCode?: string;
  uri?: string;
}> {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  try {
    const { data } = await api.auth.setupTotp(token);
    return data;
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to set up 2FA",
    };
  }
}

export async function enableTotpAction(
  code: string,
): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  try {
    await api.auth.enableTotp(token, code);
    revalidatePath("/profile");
    return {};
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to enable 2FA",
    };
  }
}

export async function disableTotpAction(
  code: string,
): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  try {
    await api.auth.disableTotp(token, code);
    revalidatePath("/profile");
    return {};
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to disable 2FA",
    };
  }
}

export async function resendVerificationAction(): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");
  try {
    await api.auth.resendVerification(token);
    return {};
  } catch (e) {
    return {
      error:
        e instanceof ApiError
          ? e.message
          : "Failed to resend verification email",
    };
  }
}

export async function createApiKeyAction(
  _prev: { error?: string; created?: ApiKeyCreatedDto },
  formData: FormData,
): Promise<{ error?: string; created?: ApiKeyCreatedDto }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const label = (formData.get("label") as string)?.trim();
  if (!label) return { error: "Label is required" };

  try {
    const { data: created } = await api.profile.createKey(token, label);
    revalidatePath("/profile");
    return { created };
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to create key",
    };
  }
}

export async function revokeApiKeyAction(
  keyId: string,
): Promise<{ error?: string }> {
  const token = await getAccessToken();
  if (!token) redirect("/login");

  try {
    await api.profile.revokeKey(token, keyId);
    revalidatePath("/profile");
    return {};
  } catch (e) {
    return {
      error: e instanceof ApiError ? e.message : "Failed to revoke key",
    };
  }
}
