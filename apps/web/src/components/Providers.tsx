"use client";

import { QueryClientProvider } from "@tanstack/react-query";
import { type ReactNode } from "react";
import { getQueryClient } from "../lib/query";

import { useSessionRefresh } from "../hooks/useSessionRefresh";

export function Providers({ children }: { children: ReactNode }) {
  // getQueryClient() returns the browser singleton — stable across re-renders
  const queryClient = getQueryClient();

  // Keep the session alive in the background
  useSessionRefresh();

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
