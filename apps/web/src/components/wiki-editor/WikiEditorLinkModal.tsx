import type { Dispatch, RefObject, SetStateAction } from "react";
import { LinkModal } from "../LinkModal";
import { restoreSelection } from "./selection";
import type {
  LinkModalType,
  SaveStatus,
  TextSelection,
  VisualEditorRef,
  WikiEditorMode,
} from "./types";
import type { WikiPageSummaryDto } from "@kanban/shared";

export function WikiEditorLinkModal({
  isOpen,
  onClose,
  type,
  pages,
  orgId,
  mode,
  content,
  pageId,
  textareaRef,
  visualRef,
  savedSelectionRange,
  handleVisualInput,
  setPageContent,
  setStatus,
  broadcast,
  scheduleSave,
}: {
  isOpen: boolean;
  onClose: () => void;
  type: LinkModalType;
  pages: WikiPageSummaryDto[];
  orgId: string;
  mode: WikiEditorMode;
  content: string;
  pageId: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  visualRef: RefObject<VisualEditorRef | null>;
  savedSelectionRange: TextSelection | null;
  handleVisualInput: (html?: string) => void;
  setPageContent: (pageId: string, content: string) => void;
  setStatus: Dispatch<SetStateAction<SaveStatus>>;
  broadcast: (val?: string, props?: Record<string, unknown>) => void;
  scheduleSave: (val: string, props?: Record<string, unknown>) => void;
}) {
  return (
    <LinkModal
      isOpen={isOpen}
      onClose={onClose}
      type={type}
      pages={pages}
      orgId={orgId}
      onSelect={(href, title) => {
        onClose();
        if (mode === "visual") {
          const el = visualRef.current?.getEl();
          if (el) {
            el.focus();
            restoreSelection(el, savedSelectionRange);
            document.execCommand("createLink", false, href);
            setTimeout(handleVisualInput, 0);
          }
          return;
        }

        const ta = textareaRef.current;
        if (!ta) return;
        const selection = content.slice(ta.selectionStart, ta.selectionEnd);
        const linkText = selection || title || "link";
        const linkMd = `[${linkText}](${href})`;
        const finalContent =
          content.slice(0, ta.selectionStart) +
          linkMd +
          content.slice(ta.selectionEnd);
        const finalStart = ta.selectionStart + linkMd.length;

        setPageContent(pageId, finalContent);
        setStatus("unsaved");
        broadcast(finalContent);
        scheduleSave(finalContent);
        requestAnimationFrame(() =>
          ta.setSelectionRange(finalStart, finalStart),
        );
      }}
    />
  );
}
