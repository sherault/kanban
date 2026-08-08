"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import * as DndKit from "@dnd-kit/core";
import { updateWikiPageAction } from "@/actions/wiki";
import type { WikiPageSummaryDto } from "@kanban/shared";
import { DeleteWikiPageDialog } from "./DeleteWikiPageDialog";
import { useWikiPageDeletion } from "./useWikiPageDeletion";

interface WikiTreeItemProps {
  page: WikiPageSummaryDto;
  orgId: string;
  projectId: string;
  hasChildren: boolean;
  isExpanded: boolean;
  isRenamable: boolean;
  isDeletable: boolean;
  descendantIds: string[];
  onToggle: () => void;
  onRenamed: () => void;
  onDeleted: () => void;
}

export function WikiTreeItem({
  page,
  orgId,
  projectId,
  hasChildren,
  isExpanded,
  isRenamable,
  isDeletable,
  descendantIds,
  onToggle,
  onRenamed,
  onDeleted,
}: WikiTreeItemProps) {
  const router = useRouter();
  const [draftTitle, setDraftTitle] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const { deletePage, isDeleting, error, resetError } = useWikiPageDeletion({
    orgId,
    projectId,
    onDeleted,
  });
  const inputRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    DndKit.useDraggable({ id: page.id });
  const { setNodeRef: setDropRef, isOver } = DndKit.useDroppable({
    id: page.id,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  // Only on entering edit mode: focus once and park the caret at the end.
  // Depending on draftTitle would re-run (and reset the caret) on every keystroke.
  const isEditing = draftTitle !== null;
  useEffect(() => {
    if (!isEditing) return;
    const input = inputRef.current;
    if (!input) return;
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [isEditing]);

  const commitRename = async () => {
    const nextTitle = draftTitle?.trim() ?? "";
    setDraftTitle(null);
    if (!nextTitle || nextTitle === page.title) return;

    setIsSaving(true);
    try {
      const result = await updateWikiPageAction(page.id, { title: nextTitle });
      if (result.error) {
        console.error("Failed to rename page", result.error);
        return;
      }
      onRenamed();
    } catch (error) {
      console.error("Failed to rename page", error);
    } finally {
      setIsSaving(false);
    }
  };

  const closeDialog = () => {
    setIsConfirmingDelete(false);
    resetError();
  };

  const confirmDelete = async () => {
    const deleted = await deletePage(page.id, descendantIds);
    if (deleted) setIsConfirmingDelete(false);
  };

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
        {isEditing ? (
          <input
            ref={inputRef}
            value={draftTitle ?? ""}
            disabled={isSaving}
            onChange={(event) => setDraftTitle(event.target.value)}
            onBlur={commitRename}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                void commitRename();
              } else if (event.key === "Escape") {
                event.preventDefault();
                setDraftTitle(null);
              }
            }}
            className="flex-1 min-w-0 text-sm text-gray-700 font-medium bg-white border border-blue-300 rounded px-1 py-0.5 outline-none focus:ring-2 focus:ring-blue-200"
          />
        ) : (
          <div
            className={`flex-1 text-sm text-gray-700 truncate font-medium select-none cursor-pointer ${isSaving ? "opacity-50" : ""}`}
            title={
              isRenamable
                ? "Double-click to rename"
                : "This page is managed automatically and cannot be renamed"
            }
            onClick={() => {
              router.push(
                `/orgs/${orgId}/projects/${projectId}/wiki/${page.id}`,
              );
              window.dispatchEvent(
                new CustomEvent("kanban_open_wiki_page", { detail: page.id }),
              );
            }}
            onDoubleClick={(event) => {
              if (!isRenamable) return;
              event.stopPropagation();
              setDraftTitle(page.title);
            }}
          >
            {page.title}
          </div>
        )}
        {isDeletable && (
          <button
            type="button"
            disabled={isDeleting}
            className="p-1 opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-600 transition-opacity disabled:opacity-50"
            title="Delete page"
            aria-label={`Delete ${page.title}`}
            onClick={(event) => {
              event.stopPropagation();
              setIsConfirmingDelete(true);
            }}
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
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
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
      {isConfirmingDelete && (
        <DeleteWikiPageDialog
          title={page.title}
          descendantCount={descendantIds.length}
          isDeleting={isDeleting}
          error={error}
          onCancel={closeDialog}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );
}
