"use client";

import type { KeyboardEvent, RefObject } from "react";
import type { TaskDto, WikiPageSummaryDto } from "@kanban/shared";
import { DescriptionEditorContext } from "./context";
import { DescriptionLinkModal } from "./DescriptionLinkModal";
import { DescriptionPreview } from "./DescriptionPreview";
import { DescriptionTextArea } from "./DescriptionTextArea";
import { DescriptionToolbar } from "./DescriptionToolbar";

type MentionItem = TaskDto | WikiPageSummaryDto;

export function InlineDescriptionEditor({
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
  onToggleFullscreen,
  onOpenLink,
  onCloseLink,
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
  onToggleFullscreen: () => void;
  onOpenLink: (type: "link" | "wiki" | "task") => void;
  onCloseLink: () => void;
}) {
  return (
    <div
      ref={containerRef}
      className="relative flex flex-col transition-all overflow-hidden bg-white border border-gray-200 rounded-lg shadow-sm"
    >
      <DescriptionEditorContext.Provider value={{ onOpenTask }}>
        <DescriptionToolbar
          textareaRef={textareaRef}
          onChange={onChange}
          showPreview={showPreview}
          onTogglePreview={onTogglePreview}
          onLink={onOpenLink}
          extra={
            <button
              onClick={onToggleFullscreen}
              title="Toggle fullscreen"
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              ↗
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
        <div className="relative flex flex-col min-h-[8rem] px-3 py-3">
          {showPreview ? (
            <div className="flex-1">
              <DescriptionPreview value={value} placeholder={placeholder} />
            </div>
          ) : (
            <DescriptionTextArea
              textareaRef={textareaRef}
              value={value}
              placeholder={placeholder}
              className="flex-1 w-full text-sm text-gray-700 outline-none resize-none min-h-[6rem] bg-transparent"
              onChange={onChange}
              onKeyDown={onKeyDown}
              onBlur={onBlur}
              mentionProps={mentionProps}
            />
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-gray-50 bg-gray-50/30">
          <span className="text-[10px] text-gray-400 font-mono italic">
            Markdown supported • Use @ to mention tasks, [[ for wiki
          </span>
        </div>
      </DescriptionEditorContext.Provider>
    </div>
  );
}
