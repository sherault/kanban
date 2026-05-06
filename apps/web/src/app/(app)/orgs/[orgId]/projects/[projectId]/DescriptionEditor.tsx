"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useWiki } from "@/context/WikiContext";
import { FullscreenDescriptionEditor } from "./description-editor/FullscreenDescriptionEditor";
import { InlineDescriptionEditor } from "./description-editor/InlineDescriptionEditor";
import { ReadOnlyDescription } from "./description-editor/ReadOnlyDescription";
import { useDescriptionMentions } from "./description-editor/useDescriptionMentions";

interface Props {
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: (value: string) => void;
  placeholder?: string;
  onOpenTask?: (taskId: string) => void;
}

export function DescriptionEditor({
  value,
  onChange,
  onFocus,
  onBlur,
  placeholder = "Add a description…",
  onOpenTask,
}: Props) {
  const params = useParams();
  const orgId = params.orgId as string;
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [wikiModalType, setWikiModalType] = useState<"link" | "wiki" | "task">(
    "wiki",
  );
  const [wikiModalOpen, _setWikiModalOpen] = useState(false);
  const { pages } = useWiki();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullScreenContainerRef = useRef<HTMLDivElement>(null);
  const wikiModalOpenRef = useRef(false);
  const isEditingRef = useRef(isEditing);
  const latestValueRef = useRef(value);
  const onBlurRef = useRef(onBlur);

  const setWikiModalOpen = useCallback((next: boolean) => {
    wikiModalOpenRef.current = next;
    _setWikiModalOpen(next);
  }, []);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);

  useEffect(() => {
    return () => {
      if (isEditingRef.current) onBlurRef.current(latestValueRef.current);
    };
  }, []);

  const mentions = useDescriptionMentions({
    orgId,
    pages,
    textareaRef,
    onChange,
  });
  const mentionProps = {
    mentionSearch: mentions.mentionSearch,
    mentionType: mentions.mentionType,
    mentionIndex: mentions.mentionIndex,
    mentionCoords: mentions.mentionCoords,
    activeResults: mentions.activeResults,
    onSelect: mentions.insertMention,
  };

  const openLinkModal = (type: "link" | "wiki" | "task") => {
    setWikiModalType(type);
    setWikiModalOpen(true);
  };

  const closeLinkModal = () => {
    setWikiModalOpen(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const startEditing = () => {
    setIsEditing(true);
    setShowPreview(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
    onFocus();
  };

  const finishEditing = () => {
    setIsEditing(false);
    onBlur(value);
    mentions.setMentionSearch(null);
  };

  function handleTextareaBlur() {
    setTimeout(() => {
      if (wikiModalOpenRef.current) return;
      const active = document.activeElement;
      if (containerRef.current?.contains(active)) return;
      if (fullScreenContainerRef.current?.contains(active)) return;
      finishEditing();
    }, 200);
  }

  function toggleFullscreen() {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      setIsEditing(true);
      setShowPreview(false);
    }
  }

  function exitFullscreen() {
    setIsFullscreen(false);
    onBlur(value);
  }

  const sharedEditorProps = {
    value,
    placeholder,
    pages,
    orgId,
    wikiModalOpen,
    wikiModalType,
    showPreview,
    textareaRef,
    mentionProps,
    onOpenTask,
    onChange: mentions.handleTextareaChange,
    onBlur: handleTextareaBlur,
    onKeyDown: mentions.handleKeyDown,
    onTogglePreview: () => setShowPreview((visible) => !visible),
    onOpenLink: openLinkModal,
    onCloseLink: closeLinkModal,
  };

  if (isFullscreen) {
    return (
      <FullscreenDescriptionEditor
        {...sharedEditorProps}
        containerRef={fullScreenContainerRef}
        onExit={exitFullscreen}
      />
    );
  }

  if (!isEditing) {
    return (
      <ReadOnlyDescription
        value={value}
        placeholder={placeholder}
        onOpenTask={onOpenTask}
        onStartEditing={startEditing}
        onToggleFullscreen={toggleFullscreen}
      />
    );
  }

  return (
    <InlineDescriptionEditor
      {...sharedEditorProps}
      containerRef={containerRef}
      onToggleFullscreen={toggleFullscreen}
    />
  );
}
