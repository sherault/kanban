import { KB_REFRESH_TOKEN_COOKIE } from "@kanban/shared";

const API_URL = process.env["API_URL"] ?? "http://localhost:3010";

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface FetchOptions extends RequestInit {
  token?: string;
  refreshToken?: string;
}

export async function apiFetch<T>(
  path: string,
  { token, refreshToken, ...init }: FetchOptions = {},
): Promise<{ data: T; headers: Headers }> {
  const headers: Record<string, string> = {
    ...(init.body && !(init.body instanceof FormData)
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(refreshToken
      ? { Cookie: `${KB_REFRESH_TOKEN_COOKIE}=${refreshToken}` }
      : {}),
    Origin: process.env["APP_URL"] ?? "http://localhost:3009",
  };

  if (init.method && init.method !== "GET") {
    console.log(`[API] ${init.method} ${path} - Origin: ${headers.Origin}`);
  }

  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  if (!res.ok) {
    const payload = (await res
      .json()
      .catch(() => ({ error: "Request failed" }))) as { error?: string };
    throw new ApiError(res.status, payload.error ?? "Request failed");
  }

  const data = (await res.json()) as T;
  return { data, headers: res.headers };
}
