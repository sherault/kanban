import type { Dispatch, RefObject, SetStateAction } from "react";
import { applyMarkdownToTextarea, TOOLBAR_ITEMS } from "./markdown";
import { saveSelection } from "./selection";
import type {
  LinkModalType,
  SaveStatus,
  TextSelection,
  VisualEditorRef,
  WikiEditorMode,
} from "./types";

export function WikiEditorToolbar({
  mode,
  content,
  pageId,
  textareaRef,
  visualRef,
  setPageContent,
  setStatus,
  broadcast,
  scheduleSave,
  handleVisualInput,
  setSavedSelectionRange,
  setLinkModalType,
  setIsLinkModalOpen,
}: {
  mode: WikiEditorMode;
  content: string;
  pageId: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  visualRef: RefObject<VisualEditorRef | null>;
  setPageContent: (pageId: string, content: string) => void;
  setStatus: Dispatch<SetStateAction<SaveStatus>>;
  broadcast: (val?: string, props?: Record<string, unknown>) => void;
  scheduleSave: (val: string, props?: Record<string, unknown>) => void;
  handleVisualInput: (html?: string) => void;
  setSavedSelectionRange: Dispatch<SetStateAction<TextSelection | null>>;
  setLinkModalType: Dispatch<SetStateAction<LinkModalType>>;
  setIsLinkModalOpen: Dispatch<SetStateAction<boolean>>;
}) {
  if (mode !== "visual" && mode !== "edit") return null;

  return (
    <div className="flex-none border-b border-gray-100 bg-gray-50/60 px-3 py-1.5 flex items-center gap-0.5 flex-wrap shrink-0">
      {TOOLBAR_ITEMS.map((btn, i) => {
        if (btn.label === "|") {
          return <div key={i} className="w-px h-5 bg-gray-200 mx-1.5" />;
        }

        return (
          <button
            key={i}
            title={btn.title}
            onMouseDown={(e) => {
              e.preventDefault();
              if (mode === "visual") {
                const el = visualRef.current?.getEl();
                if (btn.special) {
                  setSavedSelectionRange(el ? saveSelection(el) : null);
                  setLinkModalType(btn.special);
                  setIsLinkModalOpen(true);
                  return;
                }

                if (btn.execCmd) {
                  document.execCommand(
                    btn.execCmd,
                    false,
                    btn.execArg ?? undefined,
                  );
                  setTimeout(handleVisualInput, 0);
                }
                return;
              }

              const ta = textareaRef.current;
              if (!ta) return;

              if (btn.special) {
                setLinkModalType(btn.special);
                setIsLinkModalOpen(true);
                return;
              }

              const { newContent, start, end } = applyMarkdownToTextarea(
                ta,
                content,
                btn.wrap,
                btn.linePrefix,
              );
              setPageContent(pageId, newContent);
              setStatus("unsaved");
              broadcast(newContent);
              scheduleSave(newContent);
              requestAnimationFrame(() => ta.setSelectionRange(start, end));
            }}
            className="px-2 py-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all select-none"
          >
            <span className={btn.className ?? "text-sm"}>{btn.label}</span>
          </button>
        );
      })}
    </div>
  );
}
