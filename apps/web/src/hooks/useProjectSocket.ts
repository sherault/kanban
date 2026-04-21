"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { TaskDto } from "@kanban/shared";

// WS_BASE is now fetched dynamically from /api/auth/token

/** Subset of WsEvent from apps/api/src/types.ts — only task events needed here. */
type IncomingEvent =
  | {
      type: "task.created";
      payload: TaskDto;
      actorId?: string | undefined;
      isMcp?: boolean | undefined;
    }
  | {
      type: "task.updated";
      payload: TaskDto;
      actorId?: string | undefined;
      isMcp?: boolean | undefined;
    }
  | {
      type: "task.deleted";
      payload: { id: string; projectId: string };
      actorId?: string | undefined;
      isMcp?: boolean | undefined;
    };

export interface ProjectSocketCallbacks {
  onTaskCreated: (task: TaskDto, actorId?: string, isMcp?: boolean) => void;
  onTaskUpdated: (task: TaskDto, actorId?: string, isMcp?: boolean) => void;
  onTaskDeleted: (taskId: string, actorId?: string, isMcp?: boolean) => void;
}

async function fetchConfig(): Promise<{ token: string; wsUrl: string } | null> {
  try {
    const res = await fetch("/api/auth/token");
    if (!res.ok) return null;
    return (await res.json()) as { token: string; wsUrl: string };
  } catch {
    return null;
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
  callbacks: ProjectSocketCallbacks,
): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);

  // Keep a stable ref to callbacks so the WebSocket handlers always call
  // the latest version without triggering reconnect.
  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const unmountedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);

  const connect = useCallback(
    async function doConnect() {
      if (unmountedRef.current) return;

      const config = await fetchConfig();
      if (!config || unmountedRef.current) return;

      const ws = new WebSocket(
        `${config.wsUrl}/ws?token=${encodeURIComponent(config.token)}`,
      );
      wsRef.current = ws;

      ws.onopen = () => {
        if (unmountedRef.current) {
          ws.close();
          return;
        }
        // Reset backoff counter on successful connect
        attemptRef.current = 0;
        setIsConnected(true);
        ws.send(
          JSON.stringify({ type: "subscribe", room: `project:${projectId}` }),
        );
      };

      ws.onmessage = (event) => {
        let msg: IncomingEvent;
        try {
          msg = JSON.parse(event.data as string) as IncomingEvent;
        } catch {
          return; // ignore malformed frames
        }

        switch (msg.type) {
          case "task.created":
            callbacksRef.current.onTaskCreated(
              msg.payload,
              msg.actorId,
              msg.isMcp,
            );
            break;
          case "task.updated":
            callbacksRef.current.onTaskUpdated(
              msg.payload,
              msg.actorId,
              msg.isMcp,
            );
            break;
          case "task.deleted":
            callbacksRef.current.onTaskDeleted(
              msg.payload.id,
              msg.actorId,
              msg.isMcp,
            );
            break;
        }
      };

      ws.onerror = () => {
        // onerror is always followed by onclose — let onclose handle reconnect
        ws.close();
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        if (unmountedRef.current) return;

        // Exponential backoff: 100ms × 2^attempt, capped at 30 s
        const backoff = Math.min(100 * 2 ** attemptRef.current, 30_000);
        attemptRef.current += 1;
        setTimeout(() => void doConnect(), backoff);
      };
    },
    [projectId],
  );

  useEffect(() => {
    unmountedRef.current = false;
    void connect();

    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [connect]);

  return { isConnected };
}
