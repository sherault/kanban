'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { TaskDto } from '@kanban/shared'

const WS_BASE = process.env['NEXT_PUBLIC_WS_URL'] ?? 'ws://localhost:3001'

/** Subset of WsEvent from apps/api/src/types.ts — only task events needed here. */
type IncomingEvent =
  | { type: 'task.created'; payload: TaskDto }
  | { type: 'task.updated'; payload: TaskDto }
  | { type: 'task.deleted'; payload: { id: string; projectId: string } }

export interface ProjectSocketCallbacks {
  onTaskCreated: (task: TaskDto) => void
  onTaskUpdated: (task: TaskDto) => void
  onTaskDeleted: (taskId: string) => void
}

async function fetchToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/token')
    if (!res.ok) return null
    const data = (await res.json()) as { token?: string }
    return data.token ?? null
  } catch {
    return null
  }
}

/**
 * Opens a WebSocket connection to the API, subscribes to the given project
 * room, and calls the provided callbacks when task events arrive.
 *
 * Reconnects automatically with exponential backoff (100ms → 200 → 400 → …
 * up to 30 s). Cleans up on unmount.
 *
 * @param projectId  The project room to subscribe to.
 * @param callbacks  Handler functions for each event type. Stable refs are
 *                   maintained internally — you do NOT need to memoize these.
 */
export function useProjectSocket(
  projectId: string,
  callbacks: ProjectSocketCallbacks
): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false)

  // Keep a stable ref to callbacks so the WebSocket handlers always call
  // the latest version without triggering reconnect.
  const callbacksRef = useRef(callbacks)
  useEffect(() => {
    callbacksRef.current = callbacks
  })

  const unmountedRef = useRef(false)
  const wsRef = useRef<WebSocket | null>(null)
  const attemptRef = useRef(0)

  const connect = useCallback(async () => {
    if (unmountedRef.current) return

    const token = await fetchToken()
    if (!token || unmountedRef.current) return

    const ws = new WebSocket(`${WS_BASE}/ws?token=${encodeURIComponent(token)}`)
    wsRef.current = ws

    ws.onopen = () => {
      if (unmountedRef.current) {
        ws.close()
        return
      }
      // Reset backoff counter on successful connect
      attemptRef.current = 0
      setIsConnected(true)
      ws.send(JSON.stringify({ type: 'subscribe', room: `project:${projectId}` }))
    }

    ws.onmessage = (event) => {
      let msg: IncomingEvent
      try {
        msg = JSON.parse(event.data as string) as IncomingEvent
      } catch {
        return // ignore malformed frames
      }

      switch (msg.type) {
        case 'task.created':
          callbacksRef.current.onTaskCreated(msg.payload)
          break
        case 'task.updated':
          callbacksRef.current.onTaskUpdated(msg.payload)
          break
        case 'task.deleted':
          callbacksRef.current.onTaskDeleted(msg.payload.id)
          break
      }
    }

    ws.onerror = () => {
      // onerror is always followed by onclose — let onclose handle reconnect
      ws.close()
    }

    ws.onclose = () => {
      setIsConnected(false)
      wsRef.current = null
      if (unmountedRef.current) return

      // Exponential backoff: 100ms × 2^attempt, capped at 30 s
      const backoff = Math.min(100 * 2 ** attemptRef.current, 30_000)
      attemptRef.current += 1
      setTimeout(connect, backoff)
    }
  }, [projectId])

  useEffect(() => {
    unmountedRef.current = false
    void connect()

    return () => {
      unmountedRef.current = true
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [connect])

  return { isConnected }
}
