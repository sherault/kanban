"use client";

import { useState, useEffect } from "react";
import { createWikiPageAction, updateWikiPageAction } from "@/actions/wiki";
import { useWiki } from "@/context/WikiContext";
import type { WikiPageSummaryDto } from "@kanban/shared";
import * as DndKit from "@dnd-kit/core";

interface Props {
  orgId: string;
  projectId: string;
  onRefresh: () => void;
}

export function WikiSidebar({ orgId, onRefresh }: Props) {
  const { pages, isLoading } = useWiki();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    // Auto-expand root pages on initial load if we have pages
    if (pages.length > 0 && expandedIds.size === 0) {
      const rootIds = pages.filter((p) => p.parentId === null).map((p) => p.id);
      queueMicrotask(() => setExpandedIds(new Set(rootIds)));
    }
  }, [pages, expandedIds.size]);

  useEffect(() => {
    const handleCreatePage = async () => {
      try {
        const result = await createWikiPageAction(orgId, {
          title: "New Page",
          content: "# New Page\n\nEdit this page content...",
        });
        if (!result.page) {
          if (result.error)
            console.error("Failed to create wiki page", result.error);
          return;
        }
        onRefresh();
        window.dispatchEvent(
          new CustomEvent("kanban_open_wiki_page", { detail: result.page.id }),
        );
      } catch (e) {
        console.error("Failed to create wiki page", e);
      }
    };
    window.addEventListener("kanban_create_wiki_page", handleCreatePage);
    return () =>
      window.removeEventListener("kanban_create_wiki_page", handleCreatePage);
  }, [orgId, onRefresh]);

  const handleDragEnd = async (event: DndKit.DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);

    // If dropped on another item, set it as parent
    if (over && active.id !== over.id) {
      try {
        // If dropped on "root-droppable", move to root
        const newParentId =
          over.id === "root-droppable" ? null : String(over.id);

        const result = await updateWikiPageAction(String(active.id), {
          parentId: newParentId,
        });
        if (result.error) {
          console.error("Failed to move page", result.error);
          return;
        }
        onRefresh();

        // Auto-expand the new parent
        if (newParentId) {
          setExpandedIds((prev) => new Set([...Array.from(prev), newParentId]));
        }
      } catch (e) {
        console.error("Failed to move page", e);
      }
    }
  };

  const renderItem = (page: WikiPageSummaryDto, depth = 0) => {
    const hasChildren = pages.some((p) => p.parentId === page.id);
    const isExpanded = expandedIds.has(page.id);

    return (
      <div key={page.id} className="mt-1">
        <TreeItem
          page={page}
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          onToggle={() =>
            setExpandedIds((prev) => {
              const next = new Set(prev);
              if (next.has(page.id)) next.delete(page.id);
              else next.add(page.id);
              return next;
            })
          }
        />
        {isExpanded && (
          <div className="ml-3 border-l border-gray-100 pl-1">
            {pages
              .filter((p) => p.parentId === page.id)
              .map((child) => renderItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const sensors = DndKit.useSensors(
    DndKit.useSensor(DndKit.PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before dragging starts
      },
    }),
  );

  return (
    <aside className="w-64 bg-white border-r border-gray-200 shrink-0 h-full flex flex-col shadow-sm">
      <div className="flex-none h-12 px-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Knowledge Base
        </span>
        <button
          onClick={() => onRefresh()}
          className="p-1 hover:bg-gray-200 rounded text-gray-400 transition-colors"
          title="Refresh"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
            />
          </svg>
        </button>
      </div>

      <DndKit.DndContext
        sensors={sensors}
        collisionDetection={DndKit.closestCenter}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <RootDroppable />

        <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
          {isLoading ? (
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-gray-50 rounded w-5/6" />
              <div className="h-4 bg-gray-50 rounded w-2/3" />
              <div className="h-4 bg-gray-50 rounded w-3/4" />
            </div>
          ) : (
            <>
              <div className="space-y-1">
                {pages
                  .filter((p) => p.parentId === null)
                  .map((page) => renderItem(page))}
              </div>
              <DndKit.DragOverlay>
                {activeId ? (
                  <div className="bg-white shadow-xl border border-blue-100 rounded-md px-3 py-2 text-sm text-gray-600 opacity-90 cursor-grabbing border-l-4 border-l-blue-500">
                    {pages.find((p) => p.id === activeId)?.title}
                  </div>
                ) : null}
              </DndKit.DragOverlay>
            </>
          )}
        </div>
      </DndKit.DndContext>

      <div className="flex-none p-3 border-t border-gray-100 bg-gray-50/30">
        <button
          onClick={() =>
            window.dispatchEvent(new CustomEvent("kanban_create_wiki_page"))
          }
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all border border-blue-100 shadow-sm"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 4v16m8-8H4"
            />
          </svg>
          Create New Page
        </button>
      </div>
    </aside>
  );
}

function RootDroppable() {
  const { setNodeRef, isOver } = DndKit.useDroppable({
    id: "root-droppable",
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-none h-8 mx-3 mt-2 rounded border-2 border-dashed flex items-center justify-center text-[10px] font-medium transition-all ${
        isOver
          ? "border-blue-400 bg-blue-50 text-blue-600 opacity-100"
          : "border-gray-100 text-gray-300 opacity-0 hover:opacity-50"
      }`}
    >
      Drop here to move to Root
    </div>
  );
}

interface TreeItemProps {
  page: WikiPageSummaryDto;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

function TreeItem({ page, hasChildren, isExpanded, onToggle }: TreeItemProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    DndKit.useDraggable({
      id: page.id,
    });
  const { setNodeRef: setDropRef, isOver } = DndKit.useDroppable({
    id: page.id,
  });

  const style = transform
    ? {
        transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
      }
    : undefined;

  return (
    <div
      ref={setDropRef}
      className={`group relative rounded-lg transition-all ${isOver ? "bg-blue-50 ring-2 ring-blue-200" : ""}`}
    >
      <div
        ref={setNodeRef}
        style={style}
        {...attributes}
        className={`flex items-center gap-1 px-2 py-1.5 rounded-md cursor-pointer transition-colors ${isDragging ? "opacity-30" : "hover:bg-gray-100"}`}
      >
        <div
          className={`w-4 h-4 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded transition-transform ${isExpanded ? "rotate-90" : ""}`}
          onClick={(e) => {
            e.stopPropagation();
            if (hasChildren) onToggle();
          }}
        >
          {hasChildren && (
            <svg
              className="w-2.5 h-2.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          )}
        </div>

        <div
          className="flex-1 text-sm text-gray-700 truncate font-medium select-none cursor-pointer"
          onClick={() => {
            window.dispatchEvent(
              new CustomEvent("kanban_open_wiki_page", { detail: page.id }),
            );
          }}
        >
          {page.title}
        </div>

        <div
          {...listeners}
          className="p-1 opacity-0 group-hover:opacity-100 cursor-grab text-gray-300 hover:text-gray-500 transition-opacity"
          title="Drag to reorder"
        >
          <svg
            className="w-3.5 h-3.5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 8h16M4 16h16"
            />
          </svg>
        </div>
      </div>
    </div>
  );
}
