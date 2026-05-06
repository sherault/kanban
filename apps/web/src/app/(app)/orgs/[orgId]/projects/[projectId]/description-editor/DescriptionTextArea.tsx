import type { KeyboardEvent, RefObject } from "react";
import { MentionList } from "./MentionList";
import type { TaskDto, WikiPageSummaryDto } from "@kanban/shared";

type MentionItem = TaskDto | WikiPageSummaryDto;

export function DescriptionTextArea({
  textareaRef,
  value,
  placeholder,
  className,
  onChange,
  onKeyDown,
  onBlur,
  mentionProps,
  autoFocus,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  placeholder: string;
  className: string;
  onChange: (value: string) => void;
  onKeyDown: (e: KeyboardEvent) => void;
  onBlur: () => void;
  mentionProps: {
    mentionSearch: string | null;
    mentionType: "task" | "wiki";
    mentionIndex: number;
    mentionCoords: { top: number; left: number };
    activeResults: MentionItem[];
    onSelect: (item: MentionItem) => void;
  };
  autoFocus?: boolean;
}) {
  return (
    <>
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        autoFocus={autoFocus}
        placeholder={placeholder}
        className={className}
        style={{ lineHeight: "1.6" }}
      />
      <MentionList {...mentionProps} />
    </>
  );
}
