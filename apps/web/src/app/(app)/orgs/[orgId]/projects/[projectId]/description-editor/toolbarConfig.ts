export type ToolItem =
  | { type: "divider" }
  | {
      type: "action";
      icon: string;
      title: string;
      prefix: string;
      suffix: string;
      defaultText: string;
      block?: boolean;
    };

export const TOOLBAR: ToolItem[] = [
  {
    type: "action",
    icon: "B",
    title: "Bold",
    prefix: "**",
    suffix: "**",
    defaultText: "bold text",
  },
  {
    type: "action",
    icon: "I",
    title: "Italic",
    prefix: "*",
    suffix: "*",
    defaultText: "italic text",
  },
  {
    type: "action",
    icon: "`",
    title: "Inline code",
    prefix: "`",
    suffix: "`",
    defaultText: "code",
  },
  { type: "divider" },
  {
    type: "action",
    icon: "H1",
    title: "Heading 1",
    prefix: "# ",
    suffix: "",
    defaultText: "Heading",
    block: true,
  },
  {
    type: "action",
    icon: "H2",
    title: "Heading 2",
    prefix: "## ",
    suffix: "",
    defaultText: "Heading",
    block: true,
  },
  {
    type: "action",
    icon: "H3",
    title: "Heading 3",
    prefix: "### ",
    suffix: "",
    defaultText: "Heading",
    block: true,
  },
  { type: "divider" },
  {
    type: "action",
    icon: "•",
    title: "Bullet list",
    prefix: "- ",
    suffix: "",
    defaultText: "item",
    block: true,
  },
  {
    type: "action",
    icon: "1.",
    title: "Ordered list",
    prefix: "1. ",
    suffix: "",
    defaultText: "item",
    block: true,
  },
  { type: "divider" },
  {
    type: "action",
    icon: "Wiki",
    title: "Wiki Link",
    prefix: "",
    suffix: "",
    defaultText: "",
  },
  {
    type: "action",
    icon: "Task",
    title: "Task Link",
    prefix: "",
    suffix: "",
    defaultText: "",
  },
  {
    type: "action",
    icon: "Link",
    title: "External Link",
    prefix: "",
    suffix: "",
    defaultText: "",
  },
  { type: "divider" },
  {
    type: "action",
    icon: "```",
    title: "Code block",
    prefix: "```\n",
    suffix: "\n```",
    defaultText: "code",
  },
];

export function applyToolbar(
  textarea: Pick<
    HTMLTextAreaElement,
    "selectionStart" | "selectionEnd" | "value" | "focus" | "setSelectionRange"
  >,
  item: Extract<ToolItem, { type: "action" }>,
): string {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const text = textarea.value;
  const selected = text.slice(start, end) || item.defaultText;

  let result: string;
  let newStart: number;
  let newEnd: number;

  if (item.block && !item.suffix) {
    const lineStart = text.lastIndexOf("\n", start - 1) + 1;
    result = text.slice(0, lineStart) + item.prefix + text.slice(lineStart);
    newStart = start + item.prefix.length;
    newEnd = end + item.prefix.length;
  } else {
    result =
      text.slice(0, start) +
      item.prefix +
      selected +
      item.suffix +
      text.slice(end);
    newStart = start + item.prefix.length;
    newEnd = newStart + selected.length;
  }

  setTimeout(() => {
    textarea.focus();
    textarea.setSelectionRange(newStart, newEnd);
  }, 0);

  return result;
}
