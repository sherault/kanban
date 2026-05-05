"use client";

import { useState, useEffect, useCallback } from "react";
import { WikiTabs } from "@/components/WikiTabs";
import dynamic from "next/dynamic";

const WikiEditor = dynamic(
  () => import("@/components/WikiEditor").then((m) => m.WikiEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-gray-50/30 h-full">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">Loading editor...</p>
      </div>
    ),
  },
);

interface Props {
  orgId: string;
  projectId: string;
}

type WikiSplitState = {
  activePageId: string | null;
  openPageIds: string[];
};

export function WikiClient({ orgId }: Props) {
  const [splits, setSplits] = useState<WikiSplitState[]>([
    { activePageId: null, openPageIds: [] },
  ]);
  const [isSplit, setIsSplit] = useState(false);
  const [activeSplitIndex, setActiveSplitIndex] = useState(0);

  const openPageInSplit = useCallback((pageId: string, splitIndex: number) => {
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
  }, []);

  useEffect(() => {
    const handleOpenPage = (e: Event) => {
      if (!(e instanceof CustomEvent) || typeof e.detail !== "string") return;
      openPageInSplit(e.detail, activeSplitIndex);
    };

    window.addEventListener("kanban_open_wiki_page", handleOpenPage);
    return () =>
      window.removeEventListener("kanban_open_wiki_page", handleOpenPage);
  }, [activeSplitIndex, openPageInSplit]);

  const closePageInSplit = (pageId: string, splitIndex: number) => {
    setSplits((prev) => {
      const next = [...prev];
      const split = { ...next[splitIndex] };
      split.openPageIds = split.openPageIds.filter((id) => id !== pageId);
      if (split.activePageId === pageId) {
        split.activePageId =
          split.openPageIds[split.openPageIds.length - 1] || null;
      }
      next[splitIndex] = split;
      return next;
    });
  };

  const toggleSplit = () => {
    if (isSplit) {
      // Merge second split into first
      setSplits((prev) => {
        const first = { ...prev[0] };
        const second = prev[1];
        if (second) {
          const uniqueIds = Array.from(
            new Set([...first.openPageIds, ...second.openPageIds]),
          );
          first.openPageIds = uniqueIds;
          first.activePageId = second.activePageId || first.activePageId;
        }
        return [first];
      });
      setIsSplit(false);
      setActiveSplitIndex(0);
    } else {
      setSplits((prev) => [...prev, { activePageId: null, openPageIds: [] }]);
      setIsSplit(true);
      setActiveSplitIndex(1);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex-none h-12 border-b border-gray-200 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-gray-700">Wiki</h2>
        </div>
        <button
          onClick={toggleSplit}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 transition-colors"
        >
          {isSplit ? "Unsplit" : "Split View"}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {splits.map((split, idx) => (
          <div
            key={idx}
            className={`flex-1 flex flex-col min-w-0 border-l border-gray-200 first:border-l-0 ${
              activeSplitIndex === idx ? "bg-white" : "bg-gray-50/50"
            }`}
            onClick={() => setActiveSplitIndex(idx)}
          >
            <WikiTabs
              activePageId={split.activePageId}
              openPageIds={split.openPageIds}
              onTabClick={(id) => openPageInSplit(id, idx)}
              onTabClose={(id) => closePageInSplit(id, idx)}
            />
            <div className="flex-1 overflow-y-auto">
              {split.activePageId ? (
                <WikiEditor
                  key={split.activePageId}
                  pageId={split.activePageId}
                  orgId={orgId}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                  Select a page to view or edit
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
