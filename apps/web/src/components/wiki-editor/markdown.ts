import type { LinkModalType } from "./types";

export interface ToolbarItem {
  label: string;
  title?: string;
  wrap?: [string, string];
  linePrefix?: string;
  execCmd?: string;
  execArg?: string;
  className?: string;
  special?: LinkModalType;
}

export function applyMarkdownToTextarea(
  ta: Pick<HTMLTextAreaElement, "selectionStart" | "selectionEnd">,
  content: string,
  wrap?: [string, string],
  linePrefix?: string,
): { newContent: string; start: number; end: number } {
  const start = ta.selectionStart;
  const end = ta.selectionEnd;
  const selected = content.slice(start, end);

  if (wrap) {
    const [before, after] = wrap;
    const newContent =
      content.slice(0, start) + before + selected + after + content.slice(end);
    return {
      newContent,
      start: start + before.length,
      end: end + before.length,
    };
  }

  if (linePrefix) {
    const lineStart = content.lastIndexOf("\n", start - 1) + 1;
    const newContent =
      content.slice(0, lineStart) + linePrefix + content.slice(lineStart);
    return {
      newContent,
      start: lineStart + linePrefix.length,
      end: end + linePrefix.length,
    };
  }

  return { newContent: content, start, end };
}

export const TOOLBAR_ITEMS: ToolbarItem[] = [
  {
    label: "B",
    title: "Bold",
    wrap: ["**", "**"],
    execCmd: "bold",
    className: "font-black",
  },
  {
    label: "I",
    title: "Italic",
    wrap: ["*", "*"],
    execCmd: "italic",
    className: "italic",
  },
  {
    label: "U",
    title: "Underline",
    execCmd: "underline",
    className: "underline",
  },
  {
    label: "S",
    title: "Strikethrough",
    wrap: ["~~", "~~"],
    execCmd: "strikeThrough",
    className: "line-through",
  },
  { label: "|" },
  {
    label: "H1",
    title: "Heading 1",
    linePrefix: "# ",
    execCmd: "formatBlock",
    execArg: "h1",
    className: "font-black text-xs",
  },
  {
    label: "H2",
    title: "Heading 2",
    linePrefix: "## ",
    execCmd: "formatBlock",
    execArg: "h2",
    className: "font-bold text-xs",
  },
  {
    label: "H3",
    title: "Heading 3",
    linePrefix: "### ",
    execCmd: "formatBlock",
    execArg: "h3",
    className: "font-semibold text-xs",
  },
  { label: "|" },
  {
    label: "• List",
    title: "Bullet List",
    linePrefix: "- ",
    execCmd: "insertUnorderedList",
    className: "text-xs",
  },
  {
    label: "1. List",
    title: "Ordered List",
    linePrefix: "1. ",
    execCmd: "insertOrderedList",
    className: "text-xs",
  },
  {
    label: "> Quote",
    title: "Blockquote",
    linePrefix: "> ",
    execCmd: "formatBlock",
    execArg: "blockquote",
    className: "text-xs",
  },
  { label: "|" },
  {
    label: "`code`",
    title: "Inline Code",
    wrap: ["`", "`"],
    className: "font-mono text-xs",
  },
  { label: "|" },
  {
    label: "Link",
    title: "Simple Link",
    special: "link",
    className: "text-xs",
  },
  {
    label: "Wiki",
    title: "Wiki Page Link",
    special: "wiki",
    className: "text-xs font-bold",
  },
  {
    label: "Task",
    title: "Task Link",
    special: "task",
    className: "text-xs font-bold",
  },
];
