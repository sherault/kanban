import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const API_URL = process.env["API_URL"] ?? "http://localhost:3010";
const secure = process.env["NODE_ENV"] === "production";

export async function proxy(request: NextRequest) {
  const accessToken = request.cookies.get("access_token")?.value;
  if (accessToken) return NextResponse.next();

  // No access token — try to refresh silently
  const refreshToken = request.cookies.get("refresh_token")?.value;
  if (refreshToken) {
    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: { Cookie: `refresh_token=${refreshToken}` },
      });
      if (res.ok) {
        const { accessToken: newToken, refreshToken: newRefreshToken } =
          (await res.json()) as {
            accessToken: string;
            refreshToken?: string;
          };
        const response = NextResponse.next();
        response.cookies.set("access_token", newToken, {
          httpOnly: true,
          sameSite: "lax",
          secure,
          maxAge: 15 * 60,
          path: "/",
        });
        if (newRefreshToken) {
          response.cookies.set("refresh_token", newRefreshToken, {
            httpOnly: true,
            sameSite: "lax",
            secure,
            maxAge: 7 * 24 * 60 * 60, // 7 days
            path: "/",
          });
        }
        return response;
      }
    } catch {
      // refresh request failed — fall through to redirect
    }
  }

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/orgs/:path*", "/profile/:path*", "/api/:path*"],
};
