"use client";

import { useCallback, useEffect, useState } from "react";
import * as DndKit from "@dnd-kit/core";
import { updateWikiPageAction } from "@/actions/wiki";
import type { WikiPageSummaryDto } from "@kanban/shared";
import { ROOT_DROPPABLE_ID } from "./constants";

export function useWikiSidebarDrag(
  pages: WikiPageSummaryDto[],
  onRefresh: () => void,
) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (pages.length > 0 && expandedIds.size === 0) {
      const rootIds = pages.filter((p) => p.parentId === null).map((p) => p.id);
      queueMicrotask(() => setExpandedIds(new Set(rootIds)));
    }
  }, [pages, expandedIds.size]);

  const toggleExpanded = useCallback((pageId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
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
          setExpandedIds((prev) => new Set([...Array.from(prev), newParentId]));
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
    expandedIds,
    handleDragEnd,
    sensors,
    setActiveId,
    toggleExpanded,
  };
}
