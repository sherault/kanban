"use client";

import type { KeyboardEvent, RefObject } from "react";
import { createPortal } from "react-dom";
import type { TaskDto, WikiPageSummaryDto } from "@kanban/shared";
import { DescriptionEditorContext } from "./context";
import { DescriptionLinkModal } from "./DescriptionLinkModal";
import { DescriptionPreview } from "./DescriptionPreview";
import { DescriptionTextArea } from "./DescriptionTextArea";
import { DescriptionToolbar } from "./DescriptionToolbar";

type MentionItem = TaskDto | WikiPageSummaryDto;

export function FullscreenDescriptionEditor({
  value,
  placeholder,
  pages,
  orgId,
  wikiModalOpen,
  wikiModalType,
  showPreview,
  textareaRef,
  containerRef,
  mentionProps,
  onOpenTask,
  onChange,
  onBlur,
  onKeyDown,
  onTogglePreview,
  onOpenLink,
  onCloseLink,
  onExit,
}: {
  value: string;
  placeholder: string;
  pages: WikiPageSummaryDto[];
  orgId: string;
  wikiModalOpen: boolean;
  wikiModalType: "link" | "wiki" | "task";
  showPreview: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  mentionProps: {
    mentionSearch: string | null;
    mentionType: "task" | "wiki";
    mentionIndex: number;
    mentionCoords: { top: number; left: number };
    activeResults: MentionItem[];
    onSelect: (item: MentionItem) => void;
  };
  onOpenTask?: (taskId: string) => void;
  onChange: (value: string) => void;
  onBlur: () => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onTogglePreview: () => void;
  onOpenLink: (type: "link" | "wiki" | "task") => void;
  onCloseLink: () => void;
  onExit: () => void;
}) {
  return createPortal(
    <DescriptionEditorContext.Provider value={{ onOpenTask }}>
      <div
        ref={containerRef}
        className="fixed inset-0 z-[99999] flex flex-col bg-white"
      >
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
          <span className="text-sm font-semibold text-gray-700 font-mono">
            DESCRIPTION_FULLSCREEN_MODE
          </span>
          <button
            onClick={onExit}
            className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>
        <DescriptionToolbar
          textareaRef={textareaRef}
          onChange={onChange}
          showPreview={showPreview}
          onTogglePreview={onTogglePreview}
          onLink={onOpenLink}
          extra={
            <button
              onClick={onExit}
              className="ml-2 px-4 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm transition-all active:scale-95 font-medium"
            >
              Exit Fullscreen
            </button>
          }
        />
        <DescriptionLinkModal
          isOpen={wikiModalOpen}
          onClose={onCloseLink}
          type={wikiModalType}
          pages={pages}
          orgId={orgId}
          value={value}
          textareaRef={textareaRef}
          onChange={onChange}
        />
        <div className="flex-1 overflow-hidden flex flex-col px-6 py-6 max-w-5xl mx-auto w-full">
          {showPreview ? (
            <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-200">
              <DescriptionPreview value={value} placeholder={placeholder} />
            </div>
          ) : (
            <div className="h-full relative flex flex-col bg-gray-50/30 rounded-lg p-2 border border-gray-100/50">
              <DescriptionTextArea
                textareaRef={textareaRef}
                value={value}
                placeholder={placeholder}
                className="flex-1 w-full text-base text-gray-800 focus:outline-none resize-none bg-transparent px-4 py-2"
                onChange={onChange}
                onKeyDown={onKeyDown}
                onBlur={onBlur}
                mentionProps={mentionProps}
                autoFocus
              />
            </div>
          )}
        </div>
      </div>
    </DescriptionEditorContext.Provider>,
    document.body,
  );
}
