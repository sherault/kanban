/**
 * Decodes a JWT payload without verifying its signature (Base64Url only).
 * Safe for both the Node and Edge runtimes. Returns null on malformed input.
 */
export function decodeJwtPayload(
  token: string | undefined,
): Record<string, unknown> | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    while (base64.length % 4) {
      base64 += "=";
    }
    const payload: unknown = JSON.parse(atob(base64));
    return payload !== null && typeof payload === "object"
      ? (payload as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Subject (`sub`) claim of an access token, i.e. the authenticated user id. */
export function getJwtSubject(token: string | undefined): string | undefined {
  const sub = decodeJwtPayload(token)?.["sub"];
  return typeof sub === "string" && sub.length > 0 ? sub : undefined;
}
