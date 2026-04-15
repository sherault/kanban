"use client";

import { useEffect, useRef, useState, useCallback } from "react";

// WS_BASE is now fetched dynamically from /api/auth/token

type IncomingEvent = {
  type: "member.updated";
  payload: { userId: string; role: string };
};

export interface OrgSocketCallbacks {
  onMemberUpdated: (userId: string, role: string) => void;
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
 * Opens a WebSocket connection to the API and listens for org-level events.
 * The server auto-subscribes the socket to all org rooms on connect.
 */
export function useOrgSocket(
  orgId: string,
  callbacks: OrgSocketCallbacks,
): { isConnected: boolean } {
  const [isConnected, setIsConnected] = useState(false);

  const callbacksRef = useRef(callbacks);
  useEffect(() => {
    callbacksRef.current = callbacks;
  });

  const unmountedRef = useRef(false);
  const wsRef = useRef<WebSocket | null>(null);
  const attemptRef = useRef(0);

  const connect = useCallback(async function doConnect() {
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
      attemptRef.current = 0;
      setIsConnected(true);
      // Server auto-subscribes to org:${orgId} on connect — no manual subscribe needed
    };

    ws.onmessage = (event) => {
      let msg: IncomingEvent;
      try {
        msg = JSON.parse(event.data as string) as IncomingEvent;
      } catch {
        return;
      }

      if (msg.type === "member.updated") {
        callbacksRef.current.onMemberUpdated(
          msg.payload.userId,
          msg.payload.role,
        );
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    ws.onclose = () => {
      setIsConnected(false);
      wsRef.current = null;
      if (unmountedRef.current) return;

      const backoff = Math.min(100 * 2 ** attemptRef.current, 30_000);
      attemptRef.current += 1;
      setTimeout(() => void doConnect(), backoff);
    };
  }, []);

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
