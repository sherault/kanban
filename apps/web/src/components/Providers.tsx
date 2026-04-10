'use client'

import { QueryClientProvider } from '@tanstack/react-query'
import { type ReactNode } from 'react'
import { getQueryClient } from '../lib/query'

export function Providers({ children }: { children: ReactNode }) {
  // getQueryClient() returns the browser singleton — stable across re-renders
  const queryClient = getQueryClient()
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}
