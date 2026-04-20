"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Periodically hits /api/auth/token to keep the session alive.
 * Since /api/auth/token will trigger the proxy (if matchers are correct),
 * it will silently refresh the access_token cookie using the refresh_token
 * before it expires.
 */
export function useSessionRefresh() {
  const pathname = usePathname();

  useEffect(() => {
    const refresh = async () => {
      try {
        const res = await fetch("/api/auth/token");
        if (res.status === 401) {
          console.warn(
            "[session] Access token expired and couldn't be refreshed.",
          );
        }
      } catch (err) {
        console.error("[session] Failed to refresh session:", err);
      }
    };

    // Refresh on mount OR on navigation
    void refresh();

    // Refresh every 10 minutes (access token is 15 minutes)
    const interval = setInterval(refresh, 10 * 60 * 1000);

    return () => clearInterval(interval);
  }, [pathname]);
}
