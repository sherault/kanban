import type { ChangeEvent, MutableRefObject, RefObject } from "react";
import { marked } from "marked";
import type { TaskDto, WikiPageSummaryDto } from "@kanban/shared";
import { WikiPropertiesPanel } from "../WikiPropertiesPanel";
import { MarkdownPreview } from "./MarkdownPreview";
import { MarkdownTextarea } from "./MarkdownTextarea";
import { VisualEditor } from "./VisualEditor";
import type { VisualEditorRef, WikiEditorMode } from "./types";

export function WikiEditorSurface({
  mode,
  content,
  isFetching,
  textareaRef,
  visualRef,
  handleTextareaChange,
  handleVisualInputRef,
  pages,
  tasks,
  orgId,
  projectId,
  showProperties,
  properties,
  onPropertiesChange,
}: {
  mode: WikiEditorMode;
  content: string;
  isFetching: boolean;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  visualRef: RefObject<VisualEditorRef | null>;
  handleTextareaChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
  handleVisualInputRef: MutableRefObject<(html: string) => void>;
  pages: WikiPageSummaryDto[];
  tasks: TaskDto[];
  orgId: string;
  projectId: string;
  showProperties: boolean;
  properties: Record<string, unknown>;
  onPropertiesChange: (properties: Record<string, unknown>) => void;
}) {
  return (
    <div className="flex-1 flex overflow-hidden min-h-0">
      {mode === "visual" && (
        <VisualEditor
          ref={visualRef}
          initialHtml={content ? (marked(content) as string) : ""}
          onInputRef={handleVisualInputRef}
          pages={pages}
          tasks={tasks}
        />
      )}

      {mode === "edit" && (
        <MarkdownTextarea
          textareaRef={textareaRef}
          content={content}
          onChange={handleTextareaChange}
          disabled={isFetching}
        />
      )}

      {mode === "split" && (
        <>
          <div className="flex-1 h-full border-r border-gray-100">
            <MarkdownTextarea
              textareaRef={textareaRef}
              content={content}
              onChange={handleTextareaChange}
              disabled={isFetching}
            />
          </div>
          <MarkdownPreview
            content={content}
            emptyText="_Start writing on the left..._"
            orgId={orgId}
            projectId={projectId}
            pages={pages}
          />
        </>
      )}

      {mode === "view" && (
        <MarkdownPreview
          content={content}
          emptyText="_No content yet._"
          orgId={orgId}
          projectId={projectId}
          pages={pages}
        />
      )}

      {showProperties && (
        <WikiPropertiesPanel
          properties={properties}
          onChange={onPropertiesChange}
          readOnly={mode === "view"}
        />
      )}
    </div>
  );
}
