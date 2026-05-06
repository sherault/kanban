import type { ChangeEvent, RefObject } from "react";

export function MarkdownTextarea({
  textareaRef,
  content,
  disabled,
  onChange,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  content: string;
  disabled: boolean;
  onChange: (e: ChangeEvent<HTMLTextAreaElement>) => void;
}) {
  return (
    <textarea
      ref={textareaRef}
      value={content}
      onChange={onChange}
      disabled={disabled}
      className="w-full h-full p-10 font-mono text-sm leading-relaxed resize-none focus:outline-none bg-white placeholder-gray-200"
      placeholder="# Start writing in Markdown..."
    />
  );
}
