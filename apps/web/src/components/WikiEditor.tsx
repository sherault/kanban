"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { ChangeEvent } from "react";
import { marked } from "marked";
import TurndownService from "turndown";
import { useWiki } from "@/context/WikiContext";
import { WikiEditorLinkModal } from "./wiki-editor/WikiEditorLinkModal";
import { WikiEditorSurface } from "./wiki-editor/WikiEditorSurface";
import { WikiEditorToolbar } from "./wiki-editor/WikiEditorToolbar";
import { WikiEditorTopBar } from "./wiki-editor/WikiEditorTopBar";
import { useWikiBroadcast } from "./wiki-editor/useWikiBroadcast";
import { useWikiEditorPersistence } from "./wiki-editor/useWikiEditorPersistence";
import { useWikiRemoteUpdates } from "./wiki-editor/useWikiRemoteUpdates";
import type {
  LinkModalType,
  TextSelection,
  VisualEditorRef,
  WikiEditorProps,
} from "./wiki-editor/types";

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

export function WikiEditor({
  pageId,
  orgId,
  projectId,
  tasks = [],
}: WikiEditorProps) {
  const wiki = useWiki();
  const {
    pages,
    pageModes,
    setPageMode,
    pageContents,
    setPageContent,
    pageProperties,
    setPageProperties,
    ws,
    isConnected,
    tabId,
  } = wiki;
  const page = pages.find((p) => p.id === pageId);
  const mode = pageModes[pageId] || "view";
  const content = pageContents[pageId] || "";
  const properties = pageProperties[pageId] || {};

  const [showProperties, setShowProperties] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkModalType, setLinkModalType] = useState<LinkModalType>("link");
  const [savedSelectionRange, setSavedSelectionRange] =
    useState<TextSelection | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const visualRef = useRef<VisualEditorRef>(null);
  const isRemoteUpdateRef = useRef(false);

  const { status, setStatus, isFetching, scheduleSave } =
    useWikiEditorPersistence({
      pageId,
      content,
      pageContents,
      setPageContent,
      setPageProperties,
    });

  useEffect(() => {
    if (mode !== "visual" || !visualRef.current) return;
    if (!visualRef.current.getHtml() && content) {
      visualRef.current.setHtml(marked(content) as string);
    }
  }, [mode, content]);

  useWikiRemoteUpdates({
    pageId,
    textareaRef,
    visualRef,
    isRemoteUpdateRef,
    setStatus,
  });

  const broadcast = useWikiBroadcast({ ws, isConnected, orgId, pageId, tabId });

  const handleTextareaChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPageContent(pageId, val);
    setStatus("unsaved");
    broadcast(val);
    scheduleSave(val);
  };

  const handleVisualInput = useCallback(
    (html?: string) => {
      if (isRemoteUpdateRef.current) return;
      const contentToConvert = html ?? visualRef.current?.getHtml() ?? "";
      const md = td.turndown(contentToConvert);
      setPageContent(pageId, md);
      setStatus("unsaved");
      broadcast(md);
      scheduleSave(md);
    },
    [pageId, broadcast, scheduleSave, setPageContent],
  );

  const handlePropertiesChange = useCallback(
    (newProps: Record<string, unknown>) => {
      setPageProperties(pageId, newProps);
      setStatus("unsaved");
      broadcast(undefined, newProps);
      scheduleSave(content, newProps);
    },
    [pageId, broadcast, scheduleSave, setPageProperties, content],
  );

  const handleVisualInputRef = useRef(handleVisualInput);
  useLayoutEffect(() => {
    handleVisualInputRef.current = handleVisualInput;
  }, [handleVisualInput]);

  if (!page) return null;

  return (
    <div className="h-full flex flex-col bg-white overflow-hidden">
      <WikiEditorTopBar
        isConnected={isConnected}
        status={status}
        mode={mode}
        onModeChange={(nextMode) => setPageMode(pageId, nextMode)}
        showProperties={showProperties}
        onToggleProperties={() => setShowProperties((visible) => !visible)}
      />

      <WikiEditorToolbar
        mode={mode}
        content={content}
        pageId={pageId}
        textareaRef={textareaRef}
        visualRef={visualRef}
        setPageContent={setPageContent}
        setStatus={setStatus}
        broadcast={broadcast}
        scheduleSave={scheduleSave}
        handleVisualInput={handleVisualInput}
        setSavedSelectionRange={setSavedSelectionRange}
        setLinkModalType={setLinkModalType}
        setIsLinkModalOpen={setIsLinkModalOpen}
      />

      <WikiEditorSurface
        mode={mode}
        content={content}
        isFetching={isFetching}
        textareaRef={textareaRef}
        visualRef={visualRef}
        handleTextareaChange={handleTextareaChange}
        handleVisualInputRef={handleVisualInputRef}
        pages={pages}
        tasks={tasks}
        orgId={orgId}
        projectId={projectId}
        showProperties={showProperties}
        properties={properties}
        onPropertiesChange={handlePropertiesChange}
      />

      <WikiEditorLinkModal
        isOpen={isLinkModalOpen}
        onClose={() => setIsLinkModalOpen(false)}
        type={linkModalType}
        pages={pages}
        orgId={orgId}
        mode={mode}
        content={content}
        pageId={pageId}
        textareaRef={textareaRef}
        visualRef={visualRef}
        savedSelectionRange={savedSelectionRange}
        handleVisualInput={handleVisualInput}
        setPageContent={setPageContent}
        setStatus={setStatus}
        broadcast={broadcast}
        scheduleSave={scheduleSave}
      />
    </div>
  );
}
