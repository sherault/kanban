"use client";

import { useEffect } from "react";

/**
 * Periodically hits /api/auth/token to keep the session alive.
 * Since /api/auth/token will trigger the proxy (if matchers are correct),
 * it will silently refresh the access_token cookie using the refresh_token
 * before it expires.
 */
export function useSessionRefresh() {
  useEffect(() => {
    // Refresh every 10 minutes (access token is 15 minutes)
    const interval = setInterval(
      async () => {
        try {
          const res = await fetch("/api/auth/token");
          if (res.status === 401) {
            // Token couldn't be refreshed (refresh token probably expired too)
            // We could redirect to login here, but let's be passive for now
            // as the next navigation will handle it.
            console.warn(
              "[session] Access token expired and couldn't be refreshed.",
            );
          }
        } catch (err) {
          console.error("[session] Failed to refresh session:", err);
        }
      },
      10 * 60 * 1000,
    );

    return () => clearInterval(interval);
  }, []);
}
