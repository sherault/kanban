import type { TaskDto, WikiPageSummaryDto } from "@kanban/shared";
import type { MutableRefObject } from "react";

export type WikiEditorMode = "view" | "visual" | "edit" | "split";
export type SaveStatus = "saved" | "unsaved" | "saving";
export type LinkModalType = "link" | "wiki" | "task";

export interface WikiEditorProps {
  pageId: string;
  orgId: string;
  projectId: string;
  tasks?: TaskDto[];
}

export interface VisualEditorRef {
  setHtml: (html: string) => void;
  getHtml: () => string;
  getEl: () => HTMLDivElement | null;
}

export interface VisualEditorProps {
  initialHtml: string;
  onInputRef: MutableRefObject<(html: string) => void>;
  pages: WikiPageSummaryDto[];
  tasks: TaskDto[];
}

export interface TextSelection {
  start: number;
  end: number;
}
