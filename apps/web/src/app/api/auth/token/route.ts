import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { getAccessToken } from "@/lib/session";
import { KB_ACCESS_TOKEN_HEADER } from "@kanban/shared";

/**
 * GET /api/auth/token
 *
 * Returns the current access token so client-side code (WS hook) can
 * authenticate without having direct access to the httpOnly cookie.
 *
 * This endpoint is same-origin only — no CORS headers intentionally.
 */
export async function GET(): Promise<NextResponse> {
  const headersList = await headers();
  const headerToken = headersList.get(KB_ACCESS_TOKEN_HEADER);
  const token = headerToken || (await getAccessToken());

  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const host = headersList.get("host");
  const protocol = headersList.get("x-forwarded-proto") || "http";
  const wsProtocol = protocol === "https" ? "wss" : "ws";
  const isDev = process.env.NODE_ENV === "development";

  const wsUrl =
    process.env["WS_URL"] ||
    (isDev && host?.includes("localhost")
      ? "ws://localhost:3010"
      : `${wsProtocol}://${host}`);

  return NextResponse.json({
    token,
    wsUrl,
  });
}
