"use client";

import type { RefObject } from "react";
import { LinkModal } from "@/components/LinkModal";
import type { WikiPageSummaryDto } from "@kanban/shared";

export function DescriptionLinkModal({
  isOpen,
  type,
  pages,
  orgId,
  value,
  textareaRef,
  onClose,
  onChange,
}: {
  isOpen: boolean;
  type: "link" | "wiki" | "task";
  pages: WikiPageSummaryDto[];
  orgId: string;
  value: string;
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onClose: () => void;
  onChange: (value: string) => void;
}) {
  return (
    <LinkModal
      isOpen={isOpen}
      onClose={onClose}
      type={type}
      pages={pages}
      orgId={orgId}
      onSelect={(href, title) => {
        if (!textareaRef.current) return;
        const textarea = textareaRef.current;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const insertion = `[${title || (type === "link" ? href : "Link")}](${href})`;
        const newVal = value.slice(0, start) + insertion + value.slice(end);
        onChange(newVal);
        onClose();
        setTimeout(() => {
          textarea.focus();
          const newPos = start + insertion.length;
          textarea.setSelectionRange(newPos, newPos);
        }, 0);
      }}
    />
  );
}
