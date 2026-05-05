"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { WikiPageDto } from "@kanban/shared";

type IncomingEvent =
  | {
      type: "wiki.page_created";
      page: WikiPageDto;
      actorId?: string;
    }
  | {
      type: "wiki.page_updated";
      page: WikiPageDto;
      actorId?: string;
    }
  | {
      type: "wiki.page_deleted";
      pageId: string;
      actorId?: string;
    }
  | {
      type: "wiki.yjs_update";
      pageId: string;
      update?: string;
      properties?: Record<string, unknown>;
      actorId?: string;
      tabId?: string;
    }
  | {
      type: "wiki.awareness";
      pageId: string;
      awareness: string;
      actorId?: string;
      tabId?: string;
    };

export interface WikiSocketCallbacks {
  onPageCreated?: (page: WikiPageDto, actorId?: string) => void;
  onPageUpdated?: (page: WikiPageDto, actorId?: string) => void;
  onPageDeleted?: (pageId: string, actorId?: string) => void;
  onYjsUpdate?: (
    pageId: string,
    update?: string,
    properties?: Record<string, unknown>,
    actorId?: string,
    tabId?: string,
  ) => void;
  onAwareness?: (
    pageId: string,
    awareness: string,
    actorId?: string,
    tabId?: string,
  ) => void;
}

interface WikiSocketState {
  isConnected: boolean;
  currentUserId: string | null;
  userDisplayName: string | null;
  ws: WebSocket | null;
  tabId: string;
}

async function fetchConfig(): Promise<{
  token: string;
  wsUrl: string;
  userId: string;
  userDisplayName: string;
} | null> {
  try {
    const res = await fetch("/api/auth/token");
    if (!res.ok) return null;
    return (await res.json()) as {
      token: string;
      wsUrl: string;
      userId: string;
      userDisplayName: string;
    };
  } catch {
    return null;
  }
}

export function useWikiSocket(
  orgId: string,
  callbacks: WikiSocketCallbacks = {},
): WikiSocketState {
  const [isConnected, setIsConnected] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [userDisplayName, setUserDisplayName] = useState<string | null>(null);
  const [wsInstance, setWsInstance] = useState<WebSocket | null>(null);
  const tabIdRef = useRef(Math.random().toString(36).substring(2, 15));

  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  }, [callbacks]);

  const unmountedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);

  const connect = useCallback(
    async function doConnect() {
      if (unmountedRef.current) return;

      const config = await fetchConfig();
      if (!config || unmountedRef.current) return;

      setCurrentUserId(config.userId);
      setUserDisplayName(config.userDisplayName);

      const ws = new WebSocket(
        `${config.wsUrl}/ws?token=${encodeURIComponent(config.token)}`,
      );
      wsRef.current = ws;
      setWsInstance(ws);

      ws.onopen = () => {
        if (unmountedRef.current) {
          ws.close();
          return;
        }
        attemptRef.current = 0;
        setIsConnected(true);
        ws.send(JSON.stringify({ type: "subscribe", room: `org:${orgId}` }));
      };

      ws.onmessage = (event) => {
        let msg: IncomingEvent;
        try {
          msg = JSON.parse(event.data as string) as IncomingEvent;
        } catch {
          return;
        }

        switch (msg.type) {
          case "wiki.page_created":
            callbacksRef.current.onPageCreated?.(msg.page, msg.actorId);
            break;
          case "wiki.page_updated":
            callbacksRef.current.onPageUpdated?.(msg.page, msg.actorId);
            break;
          case "wiki.page_deleted":
            callbacksRef.current.onPageDeleted?.(msg.pageId, msg.actorId);
            break;
          case "wiki.yjs_update":
            callbacksRef.current.onYjsUpdate?.(
              msg.pageId,
              msg.update,
              msg.properties,
              msg.actorId,
              msg.tabId,
            );
            break;
          case "wiki.awareness":
            callbacksRef.current.onAwareness?.(
              msg.pageId,
              msg.awareness,
              msg.actorId,
              msg.tabId,
            );
            break;
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        wsRef.current = null;
        setWsInstance(null);
        if (unmountedRef.current) return;

        const backoff = Math.min(100 * 2 ** attemptRef.current, 30_000);
        attemptRef.current += 1;
        setTimeout(() => void doConnect(), backoff);
      };
    },
    [orgId],
  );

  useEffect(() => {
    unmountedRef.current = false;
    void connect();

    return () => {
      unmountedRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
      setWsInstance(null);
    };
  }, [connect]);

  return {
    isConnected,
    currentUserId,
    userDisplayName,
    ws: wsInstance,
    tabId: tabIdRef.current,
  };
}
