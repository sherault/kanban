import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  KB_ACCESS_TOKEN_COOKIE,
  KB_REFRESH_TOKEN_COOKIE,
  KB_ACCESS_TOKEN_HEADER,
  createLogger,
} from "@kanban/shared";

const API_URL = process.env["API_URL"] ?? "http://localhost:3010";
const APP_URL = process.env["APP_URL"] ?? "http://localhost:3000";
const secure = process.env["NODE_ENV"] === "production";

const logger = createLogger("proxy");

/**
 * Decodes a JWT payload without verification (Base64 only).
 */
function isTokenExpiringSoon(token: string | undefined): boolean {
  if (!token) return true;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return true;

    // Base64Url to Base64
    let base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    // Add padding if missing
    while (base64.length % 4) {
      base64 += "=";
    }

    const payload = JSON.parse(atob(base64));
    const exp = payload.exp;
    if (!exp) return true;
    const now = Math.floor(Date.now() / 1000);
    const lifeLeft = exp - now;

    logger.debug(`Token life left: ${lifeLeft}s (threshold: 360s)`);
    return lifeLeft < 6 * 60;
  } catch (err) {
    logger.warn("Token decode failed", err);
    return true;
  }
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get(KB_ACCESS_TOKEN_COOKIE)?.value;
  const refreshToken = request.cookies.get(KB_REFRESH_TOKEN_COOKIE)?.value;

  const shouldRefresh = isTokenExpiringSoon(accessToken);

  logger.debug(
    `Processing: ${pathname}, hasAccessToken: ${!!accessToken}, hasRefreshToken: ${!!refreshToken}, shouldRefresh: ${shouldRefresh}`,
  );

  if (!shouldRefresh && accessToken) {
    return NextResponse.next();
  }

  // Token is either missing OR expiring soon
  if (refreshToken) {
    logger.info(`Silent refresh triggered for ${pathname}`);

    try {
      const res = await fetch(`${API_URL}/auth/refresh`, {
        method: "POST",
        headers: {
          Cookie: `${KB_REFRESH_TOKEN_COOKIE}=${refreshToken}`,
          Origin: APP_URL,
        },
        cache: "no-store",
      });

      if (res.ok) {
        const { accessToken: newToken, refreshToken: newRefreshToken } =
          (await res.json()) as {
            accessToken: string;
            refreshToken?: string;
          };

        logger.info(`Silent refresh success for ${pathname}`);

        const requestHeaders = new Headers(request.headers);
        requestHeaders.set(KB_ACCESS_TOKEN_HEADER, newToken);

        const response = NextResponse.next({
          request: {
            headers: requestHeaders,
          },
        });

        response.cookies.set(KB_ACCESS_TOKEN_COOKIE, newToken, {
          httpOnly: true,
          sameSite: "lax",
          secure,
          maxAge: 15 * 60,
          path: "/",
        });

        if (newRefreshToken) {
          response.cookies.set(KB_REFRESH_TOKEN_COOKIE, newRefreshToken, {
            httpOnly: true,
            sameSite: "lax",
            secure,
            maxAge: 7 * 24 * 60 * 60,
            path: "/",
          });
        }
        return response;
      } else {
        logger.warn(
          `Silent refresh API failed (status: ${res.status}) for ${pathname}`,
        );
      }
    } catch (err) {
      logger.error(`Silent refresh FETCH failed for ${pathname}`, err);
    }
  }

  if (accessToken) {
    // Proactive refresh failed, but we still have an access token.
    return NextResponse.next();
  }

  // NO access token and NO successful refresh. This is a dead session.
  logger.info(`Session expired/missing for ${pathname}. Redirecting to /login`);

  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("from", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/orgs/:path*", "/profile/:path*", "/api/:path*"],
};
