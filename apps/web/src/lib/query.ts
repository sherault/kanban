import { QueryClient } from "@tanstack/react-query";

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Data is considered fresh for 60 seconds — avoids redundant refetches
        // on tab focus. WS events keep the cache up to date instead.
        staleTime: 60 * 1000,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

/**
 * Returns a stable QueryClient.
 * - Server: always a fresh instance (prevents cross-request state leaks).
 * - Browser: singleton so the cache persists across renders.
 */
export function getQueryClient(): QueryClient {
  if (typeof window === "undefined") return makeQueryClient();
  if (!browserQueryClient) browserQueryClient = makeQueryClient();
  return browserQueryClient;
}
