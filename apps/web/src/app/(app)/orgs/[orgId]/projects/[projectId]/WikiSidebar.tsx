"use client";

import { useWiki } from "@/context/WikiContext";
import * as DndKit from "@dnd-kit/core";
import { CreateWikiPageButton } from "./wiki-sidebar/CreateWikiPageButton";
import { RootDroppable } from "./wiki-sidebar/RootDroppable";
import { useWikiSidebarCreatePage } from "./wiki-sidebar/useWikiSidebarCreatePage";
import { useWikiSidebarDrag } from "./wiki-sidebar/useWikiSidebarDrag";
import { WikiDragOverlay } from "./wiki-sidebar/WikiDragOverlay";
import { WikiSidebarHeader } from "./wiki-sidebar/WikiSidebarHeader";
import { WikiSidebarLoading } from "./wiki-sidebar/WikiSidebarLoading";
import { WikiTree } from "./wiki-sidebar/WikiTree";

interface Props {
  orgId: string;
  projectId: string;
  onRefresh: () => void;
}

export function WikiSidebar({ orgId, projectId, onRefresh }: Props) {
  const { pages, isLoading } = useWiki();
  useWikiSidebarCreatePage({ orgId, projectId, onRefresh });
  const {
    activeId,
    expandedIds,
    handleDragEnd,
    sensors,
    setActiveId,
    toggleExpanded,
  } = useWikiSidebarDrag(pages, onRefresh);

  return (
    <aside className="w-64 bg-white border-r border-gray-200 shrink-0 h-full flex flex-col shadow-sm">
      <WikiSidebarHeader onRefresh={onRefresh} />
      <DndKit.DndContext
        sensors={sensors}
        collisionDetection={DndKit.closestCenter}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <RootDroppable />

        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {isLoading ? (
            <WikiSidebarLoading />
          ) : (
            <>
              <WikiTree
                pages={pages}
                orgId={orgId}
                projectId={projectId}
                expandedIds={expandedIds}
                onToggle={toggleExpanded}
              />
              <WikiDragOverlay activeId={activeId} pages={pages} />
            </>
          )}
        </div>
      </DndKit.DndContext>
      <CreateWikiPageButton />
    </aside>
  );
}
