import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type RefObject,
  type SetStateAction,
} from "react";
import { marked } from "marked";
import type { SaveStatus, TextSelection, VisualEditorRef } from "./types";

export function useWikiRemoteUpdates({
  pageId,
  textareaRef,
  visualRef,
  isRemoteUpdateRef,
  setStatus,
}: {
  pageId: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  visualRef: RefObject<VisualEditorRef | null>;
  isRemoteUpdateRef: MutableRefObject<boolean>;
  setStatus: Dispatch<SetStateAction<SaveStatus>>;
}) {
  const [restoreTrigger, setRestoreTrigger] = useState(0);
  const remoteCursorRef = useRef<TextSelection | null>(null);

  useLayoutEffect(() => {
    if (restoreTrigger === 0) return;
    if (remoteCursorRef.current && textareaRef.current) {
      const { start, end } = remoteCursorRef.current;
      remoteCursorRef.current = null;
      textareaRef.current.setSelectionRange(start, end);
    }
  }, [restoreTrigger, textareaRef]);

  useEffect(() => {
    const handleRemoteUpdate = (e: Event) => {
      if (!(e instanceof CustomEvent)) return;
      const { content: rawContent } = e.detail;

      if (rawContent !== undefined) {
        if (textareaRef.current) {
          remoteCursorRef.current = {
            start: textareaRef.current.selectionStart,
            end: textareaRef.current.selectionEnd,
          };
        }
        if (visualRef.current) {
          isRemoteUpdateRef.current = true;
          visualRef.current.setHtml(marked(rawContent) as string);
          isRemoteUpdateRef.current = false;
        }
        setRestoreTrigger((n) => n + 1);
      }
      setStatus("saved");
    };

    window.addEventListener(`wiki_remote_update_${pageId}`, handleRemoteUpdate);
    return () =>
      window.removeEventListener(
        `wiki_remote_update_${pageId}`,
        handleRemoteUpdate,
      );
  }, [pageId, textareaRef, visualRef, isRemoteUpdateRef, setStatus]);
}
