"use client";

import { useCallback, useEffect, useState } from "react";
import * as DndKit from "@dnd-kit/core";
import { updateWikiPageAction } from "@/actions/wiki";
import type { WikiPageSummaryDto } from "@kanban/shared";
import { readWikiExpanded, writeWikiExpanded } from "@/lib/wikiExpandedStorage";
import { ROOT_DROPPABLE_ID } from "./constants";

const EMPTY_EXPANDED: Set<string> = new Set();

export function useWikiSidebarDrag(
  pages: WikiPageSummaryDto[],
  onRefresh: () => void,
  orgId: string,
) {
  // null = nothing restored yet, so the root-expansion default still applies.
  const [expandedIds, setExpandedIds] = useState<Set<string> | null>(() =>
    readWikiExpanded(orgId),
  );
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    setExpandedIds(readWikiExpanded(orgId));
  }, [orgId]);

  useEffect(() => {
    if (pages.length > 0 && expandedIds === null) {
      const rootIds = pages.filter((p) => p.parentId === null).map((p) => p.id);
      queueMicrotask(() => setExpandedIds(new Set(rootIds)));
    }
  }, [pages, expandedIds]);

  useEffect(() => {
    if (expandedIds !== null) writeWikiExpanded(orgId, expandedIds);
  }, [orgId, expandedIds]);

  const toggleExpanded = useCallback((pageId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev ?? EMPTY_EXPANDED);
      if (next.has(pageId)) {
        next.delete(pageId);
      } else {
        next.add(pageId);
      }
      return next;
    });
  }, []);

  const handleDragEnd = useCallback(
    async (event: DndKit.DragEndEvent) => {
      const { active, over } = event;
      setActiveId(null);

      if (!over || active.id === over.id) return;

      try {
        const newParentId =
          over.id === ROOT_DROPPABLE_ID ? null : String(over.id);
        const result = await updateWikiPageAction(String(active.id), {
          parentId: newParentId,
        });
        if (result.error) {
          console.error("Failed to move page", result.error);
          return;
        }

        onRefresh();
        if (newParentId) {
          setExpandedIds(
            (prev) => new Set([...(prev ?? EMPTY_EXPANDED), newParentId]),
          );
        }
      } catch (error) {
        console.error("Failed to move page", error);
      }
    },
    [onRefresh],
  );

  const sensors = DndKit.useSensors(
    DndKit.useSensor(DndKit.PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
  );

  return {
    activeId,
    expandedIds: expandedIds ?? EMPTY_EXPANDED,
    handleDragEnd,
    sensors,
    setActiveId,
    toggleExpanded,
  };
}
