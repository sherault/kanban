"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { ReactNode } from "react";
import type { WikiPageSummaryDto } from "@kanban/shared";
import { useWikiSocket } from "@/hooks/useWikiSocket";

interface WikiSplitState {
  activePageId: string | null;
  openPageIds: string[];
}

interface WikiContextType {
  pages: WikiPageSummaryDto[];
  setPages: (pages: WikiPageSummaryDto[]) => void;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  pageModes: Record<string, "edit" | "view" | "split" | "visual">;
  setPageMode: (
    pageId: string,
    mode: "edit" | "view" | "split" | "visual",
  ) => void;
  pageContents: Record<string, string>;
  setPageContent: (pageId: string, content: string) => void;
  pageProperties: Record<string, Record<string, unknown>>;
  setPageProperties: (
    pageId: string,
    properties: Record<string, unknown>,
  ) => void;
  // Splits / Tabs state
  splits: WikiSplitState[];
  setSplits: React.Dispatch<React.SetStateAction<WikiSplitState[]>>;
  isSplit: boolean;
  setIsSplit: (split: boolean) => void;
  activeSplitIndex: number;
  setActiveSplitIndex: (index: number) => void;
  openPageInSplit: (pageId: string, splitIndex: number) => void;
  closePageInSplit: (pageId: string, splitIndex: number) => void;
  // WebSocket state
  isConnected: boolean;
  ws: WebSocket | null;
  tabId: string;
}

const WikiContext = createContext<WikiContextType | undefined>(undefined);

export function WikiProvider({
  children,
  orgId,
}: {
  children: ReactNode;
  orgId: string;
}) {
  const { ws, isConnected, tabId } = useWikiSocket(orgId, {
    onPageCreated: () => {
      window.dispatchEvent(new CustomEvent("kanban_wiki_page_updated"));
    },
    onPageUpdated: (_p) => {
      window.dispatchEvent(new CustomEvent("kanban_wiki_page_updated"));
    },
    onPageDeleted: () => {
      window.dispatchEvent(new CustomEvent("kanban_wiki_page_updated"));
    },
    onYjsUpdate: (
      receivedPageId,
      rawContent,
      rawProperties,
      _actorId,
      msgTabId,
    ) => {
      if (msgTabId === tabId) return;

      if (rawProperties) {
        setPagePropertiesState((prev) => ({
          ...prev,
          [receivedPageId]: rawProperties,
        }));
      }

      if (rawContent !== undefined) {
        setPageContents((prev) => ({ ...prev, [receivedPageId]: rawContent }));
        // Dispatch event for the specific editor to handle visual/cursor updates
        window.dispatchEvent(
          new CustomEvent(`wiki_remote_update_${receivedPageId}`, {
            detail: { content: rawContent, properties: rawProperties },
          }),
        );
      }
    },
  });
  const [pages, setPages] = useState<WikiPageSummaryDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [pageModes, setPageModes] = useState<
    Record<string, "edit" | "view" | "split" | "visual">
  >({});
  const [pageContents, setPageContents] = useState<Record<string, string>>({});
  const [pageProperties, setPagePropertiesState] = useState<
    Record<string, Record<string, unknown>>
  >({});

  // Splits state
  const [splits, setSplits] = useState<WikiSplitState[]>([
    { activePageId: null, openPageIds: [] },
  ]);
  const [isSplit, setIsSplit] = useState(false);
  const [activeSplitIndex, setActiveSplitIndex] = useState(0);

  const setPageMode = useCallback(
    (pageId: string, mode: "edit" | "view" | "split" | "visual") => {
      setPageModes((prev) => ({ ...prev, [pageId]: mode }));
    },
    [setPageModes],
  );

  const setPageContent = useCallback(
    (pageId: string, content: string) => {
      setPageContents((prev) => ({ ...prev, [pageId]: content }));
    },
    [setPageContents],
  );

  const setPageProperties = useCallback(
    (pageId: string, properties: Record<string, unknown>) => {
      setPagePropertiesState((prev) => ({ ...prev, [pageId]: properties }));
    },
    [setPagePropertiesState],
  );

  const openPageInSplit = useCallback(
    (pageId: string, splitIndex: number) => {
      setSplits((prev) => {
        const next = [...prev];
        const currentSplit = next[splitIndex];
        if (!currentSplit) return prev;
        const split = { ...currentSplit };
        if (!split.openPageIds.includes(pageId)) {
          split.openPageIds = [...split.openPageIds, pageId];
        }
        split.activePageId = pageId;
        next[splitIndex] = split;
        return next;
      });
    },
    [setSplits],
  );

  const closePageInSplit = useCallback(
    (pageId: string, splitIndex: number) => {
      setSplits((prev) => {
        const next = [...prev];
        const split = { ...next[splitIndex] };
        if (!split) return prev;
        split.openPageIds = split.openPageIds.filter((id) => id !== pageId);
        if (split.activePageId === pageId) {
          split.activePageId =
            split.openPageIds[split.openPageIds.length - 1] || null;
        }
        next[splitIndex] = split;
        return next;
      });
    },
    [setSplits],
  );

  const value = {
    pages,
    setPages,
    isLoading,
    setIsLoading,
    pageModes,
    setPageMode,
    pageContents,
    setPageContent,
    pageProperties,
    setPageProperties,
    splits,
    setSplits,
    isSplit,
    setIsSplit,
    activeSplitIndex,
    setActiveSplitIndex,
    openPageInSplit,
    closePageInSplit,
    isConnected,
    ws,
    tabId,
  };

  return <WikiContext.Provider value={value}>{children}</WikiContext.Provider>;
}

export function useWiki() {
  const context = useContext(WikiContext);
  if (!context) {
    throw new Error("useWiki must be used within a WikiProvider");
  }
  return context;
}
