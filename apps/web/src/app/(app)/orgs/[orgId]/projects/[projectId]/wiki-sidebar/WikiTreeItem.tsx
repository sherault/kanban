"use client";

import { useRouter } from "next/navigation";
import * as DndKit from "@dnd-kit/core";
import type { WikiPageSummaryDto } from "@kanban/shared";

interface WikiTreeItemProps {
  page: WikiPageSummaryDto;
  orgId: string;
  projectId: string;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}

export function WikiTreeItem({
  page,
  orgId,
  projectId,
  hasChildren,
  isExpanded,
  onToggle,
}: WikiTreeItemProps) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    DndKit.useDraggable({ id: page.id });
  const { setNodeRef: setDropRef, isOver } = DndKit.useDroppable({
    id: page.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
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
          onClick={(event) => {
            event.stopPropagation();
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
            router.push(`/orgs/${orgId}/projects/${projectId}/wiki/${page.id}`);
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
