import { useCallback, useEffect, useRef, useState } from "react";
import { getWikiPageAction, updateWikiPageAction } from "@/actions/wiki";
import type { SaveStatus } from "./types";

export function useWikiEditorPersistence({
  pageId,
  content,
  pageContents,
  setPageContent,
  setPageProperties,
}: {
  pageId: string;
  content: string;
  pageContents: Record<string, string>;
  setPageContent: (pageId: string, content: string) => void;
  setPageProperties: (
    pageId: string,
    properties: Record<string, unknown>,
  ) => void;
}) {
  const [status, setStatus] = useState<SaveStatus>("saved");
  const [isFetching, setIsFetching] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (Object.prototype.hasOwnProperty.call(pageContents, pageId)) return;

    void (async () => {
      setIsFetching(true);
      try {
        const result = await getWikiPageAction(pageId);
        if (!result.page) {
          if (result.error)
            console.error("[WikiEditor] Fetch failed:", result.error);
          return;
        }
        setPageContent(pageId, result.page.content || "");
        setPageProperties(pageId, result.page.properties || {});
        setStatus("saved");
      } catch (e) {
        console.error("[WikiEditor] Fetch failed:", e);
      } finally {
        setIsFetching(false);
      }
    })();
  }, [pageId, pageContents, setPageContent, setPageProperties]);

  const handleSave = useCallback(
    async (val: string, props?: Record<string, unknown>) => {
      if (!val && !props) return;
      setStatus("saving");
      try {
        const result = await updateWikiPageAction(pageId, {
          content: val,
          properties: props,
        });
        if (result.error) throw new Error(result.error);
        setStatus("saved");
      } catch {
        setStatus("unsaved");
      }
    },
    [pageId],
  );

  const scheduleSave = useCallback(
    (val: string, props?: Record<string, unknown>) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = setTimeout(() => handleSave(val, props), 2500);
    },
    [handleSave],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        void handleSave(content);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleSave, content]);

  return { status, setStatus, isFetching, scheduleSave };
}
