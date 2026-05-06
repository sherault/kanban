import { useCallback } from "react";

export function useWikiBroadcast({
  ws,
  isConnected,
  orgId,
  pageId,
  tabId,
}: {
  ws: WebSocket | null;
  isConnected: boolean;
  orgId: string;
  pageId: string;
  tabId: string;
}) {
  return useCallback(
    (val?: string, props?: Record<string, unknown>) => {
      if (!ws || !isConnected) return;
      ws.send(
        JSON.stringify({
          type: "wiki.yjs_update",
          room: `org:${orgId}`,
          pageId,
          update: val,
          properties: props,
          tabId,
        }),
      );
    },
    [ws, isConnected, orgId, pageId, tabId],
  );
}
