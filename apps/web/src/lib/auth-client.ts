"use client";

/**
 * Fetches the current access token from the Next.js API route.
 * This is safe to use in Client Components because it hits a same-origin endpoint
 * that has access to httpOnly cookies on the server side.
 */
export async function getClientAccessToken(): Promise<string | null> {
  try {
    const res = await fetch("/api/auth/token");
    if (!res.ok) return null;
    const { token } = await res.json();
    return token;
  } catch (err) {
    console.error("[auth-client] Failed to fetch access token:", err);
    return null;
  }
}
