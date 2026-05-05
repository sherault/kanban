"use client";

import {
  useState,
  useEffect,
  useLayoutEffect,
  useRef,
  useCallback,
  memo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { LinkModal } from "./LinkModal";
import { useWiki } from "@/context/WikiContext";
import { useWikiSocket } from "@/hooks/useWikiSocket";
import { getWikiPageAction, updateWikiPageAction } from "@/actions/wiki";
import { getTaskByIdAction } from "@/actions/tasks";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { marked } from "marked";
import TurndownService from "turndown";
import { WikiPropertiesPanel } from "./WikiPropertiesPanel";
import type { WikiPageSummaryDto, TaskDto } from "@kanban/shared";

interface Props {
  pageId: string;
  orgId: string;
  projectId: string;
}

type SaveStatus = "saved" | "unsaved" | "saving";

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

// Insert markdown syntax around selection in a textarea
function applyMarkdownToTextarea(
  ta: HTMLTextAreaElement,
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

const TOOLBAR_ITEMS = [
  {
    label: "B",
    title: "Bold",
    wrap: ["**", "**"] as [string, string],
    execCmd: "bold",
    className: "font-black",
  },
  {
    label: "I",
    title: "Italic",
    wrap: ["*", "*"] as [string, string],
    execCmd: "italic",
    className: "italic",
  },
  {
    label: "U",
    title: "Underline",
    wrap: undefined,
    execCmd: "underline",
    className: "underline",
  },
  {
    label: "S",
    title: "Strikethrough",
    wrap: ["~~", "~~"] as [string, string],
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
    wrap: ["`", "`"] as [string, string],
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

// ── Selection Helpers for contentEditable ───────────────────────────────────
function saveSelection(containerEl: HTMLElement) {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) return null;
  if (!containerEl.contains(selection.anchorNode)) return null;

  const range = selection.getRangeAt(0);

  function getOffset(targetNode: Node, targetOffset: number) {
    let charIndex = 0;
    const nodeStack: Node[] = [containerEl];
    let node: Node | undefined;

    while ((node = nodeStack.pop())) {
      if (node === targetNode) {
        if (node.nodeType === 3) {
          return charIndex + targetOffset;
        } else {
          for (let i = 0; i < targetOffset; i++) {
            charIndex += node.childNodes[i].textContent?.length || 0;
          }
          return charIndex;
        }
      }
      if (node.nodeType === 3) {
        charIndex += node.nodeValue?.length || 0;
      } else {
        let i = node.childNodes.length;
        while (i--) {
          nodeStack.push(node.childNodes[i]);
        }
      }
    }
    return charIndex;
  }

  return {
    start: getOffset(range.startContainer, range.startOffset),
    end: getOffset(range.endContainer, range.endOffset),
  };
}

function restoreSelection(
  containerEl: HTMLElement,
  savedSel: { start: number; end: number } | null,
) {
  if (!savedSel) return;
  let charIndex = 0;
  const range = document.createRange();
  range.setStart(containerEl, 0);
  range.collapse(true);

  const nodeStack: Node[] = [containerEl];
  let node: Node | undefined;
  let foundStart = false;
  let stop = false;

  while (!stop && (node = nodeStack.pop())) {
    if (node.nodeType === 3) {
      // Text node
      const nextCharIndex = charIndex + (node.nodeValue?.length || 0);
      if (
        !foundStart &&
        savedSel.start >= charIndex &&
        savedSel.start <= nextCharIndex
      ) {
        range.setStart(node, savedSel.start - charIndex);
        foundStart = true;
      }
      if (
        foundStart &&
        savedSel.end >= charIndex &&
        savedSel.end <= nextCharIndex
      ) {
        range.setEnd(node, savedSel.end - charIndex);
        stop = true;
      }
      charIndex = nextCharIndex;
    } else {
      let i = node.childNodes.length;
      while (i--) {
        nodeStack.push(node.childNodes[i]);
      }
    }
  }

  const sel = window.getSelection();
  if (sel) {
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function adjustCursorOffset(
  oldText: string,
  newText: string,
  cursor: number,
): number {
  if (oldText === newText) return cursor;

  // Find common prefix length
  let prefix = 0;
  const minLen = Math.min(oldText.length, newText.length);
  while (prefix < minLen && oldText[prefix] === newText[prefix]) {
    prefix++;
  }

  // If the change happens strictly after the cursor, no adjustment needed
  if (cursor <= prefix) {
    return cursor;
  }

  // Find common suffix length
  let suffix = 0;
  while (
    suffix < minLen - prefix &&
    oldText[oldText.length - 1 - suffix] ===
      newText[newText.length - 1 - suffix]
  ) {
    suffix++;
  }

  const oldChangedEnd = oldText.length - suffix;
  const newChangedEnd = newText.length - suffix;

  if (cursor >= oldChangedEnd) {
    // Cursor is after the changed region. Shift by the exact delta.
    return cursor + (newText.length - oldText.length);
  }

  // Cursor was inside the changed region (someone typed over where we were).
  // Safest fallback is to place the cursor at the end of the new inserted text.
  return newChangedEnd;
}

// ── Memoized Uncontrolled Editor ────────────────────────────────────────────
// This component NEVER re-renders. This completely guarantees React will
// never touch the DOM or mess with the cursor. Remote updates are applied
// imperatively via the exposed ref.
interface VisualEditorRef {
  setHtml: (html: string) => void;
  getHtml: () => string;
  getEl: () => HTMLDivElement | null;
}

const VisualEditor = memo(
  forwardRef<
    VisualEditorRef,
    {
      initialHtml: string;
      onInputRef: React.MutableRefObject<(html: string) => void>;
      pages: WikiPageSummaryDto[];
      tasks: TaskDto[];
    }
  >(({ initialHtml, onInputRef, pages, tasks }, ref) => {
    const divRef = useRef<HTMLDivElement>(null);

    const [tooltip, setTooltip] = useState<{
      href: string;
      rect: Partial<DOMRect>;
    } | null>(null);

    const [taskCache, setTaskCache] = useState<Record<string, string>>({});

    useEffect(() => {
      const el = divRef.current;
      if (!el) return;

      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest("a");
        if (anchor && el.contains(anchor)) {
          e.preventDefault();
          // Instead of navigating, show a tooltip
          const href = anchor.getAttribute("href") || "";
          const rect = anchor.getBoundingClientRect();
          const parentRect = el.getBoundingClientRect();

          setTooltip({
            href,
            rect: {
              ...rect,
              // Adjust rect relative to the editor container
              left: rect.left - parentRect.left,
              top: rect.top - parentRect.top,
              bottom: rect.bottom - parentRect.top,
              right: rect.right - parentRect.left,
            } as DOMRect,
          });

          // Fetch task title if missing
          if (href.startsWith("task://")) {
            const id = href.replace("task://", "");
            const isKnown = tasks.some((t) => t.id === id) || taskCache[id];
            if (!isKnown) {
              void getTaskByIdAction(id).then((res) => {
                if (res.task) {
                  setTaskCache((prev) => ({ ...prev, [id]: res.task!.title }));
                } else {
                  setTaskCache((prev) => ({
                    ...prev,
                    [id]: `Unknown (${id.slice(0, 4)})`,
                  }));
                }
              });
            }
          }

          // Auto-hide after 2 seconds
          setTimeout(() => setTooltip(null), 2000);
        } else {
          setTooltip(null);
        }
      };

      el.addEventListener("click", handleClick);
      return () => el.removeEventListener("click", handleClick);
    }, [taskCache, tasks, pages]);

    useImperativeHandle(ref, () => ({
      setHtml: (html: string) => {
        if (divRef.current && divRef.current.innerHTML !== html) {
          const oldText = divRef.current.textContent || "";
          const savedSel = saveSelection(divRef.current);

          divRef.current.innerHTML = html;

          if (savedSel) {
            const newText = divRef.current.textContent || "";
            const adjustedStart = adjustCursorOffset(
              oldText,
              newText,
              savedSel.start,
            );
            const adjustedEnd = adjustCursorOffset(
              oldText,
              newText,
              savedSel.end,
            );
            restoreSelection(divRef.current, {
              start: adjustedStart,
              end: adjustedEnd,
            });
          }
        }
      },
      getHtml: () => {
        return divRef.current?.innerHTML || "";
      },
      getEl: () => divRef.current,
    }));

    return (
      <div className="relative w-full h-full min-h-0 flex flex-col">
        <div
          ref={divRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onInputRef.current(e.currentTarget.innerHTML)}
          className="w-full h-full overflow-y-auto p-10 prose prose-slate max-w-none focus:outline-none prose-headings:font-black prose-headings:tracking-tighter prose-pre:bg-gray-900 prose-pre:rounded-xl"
          dangerouslySetInnerHTML={{ __html: initialHtml }}
        />
        {tooltip &&
          (() => {
            let label = tooltip.href;
            let isError = false;

            if (tooltip.href.startsWith("wiki://")) {
              const id = tooltip.href.replace("wiki://", "");
              const p = pages.find((p) => p.id === id);
              if (p) {
                label = `Wiki: ${p.title}`;
              } else {
                label = "Error: Wiki page not found";
                isError = true;
              }
            } else if (tooltip.href.startsWith("task://")) {
              const id = tooltip.href.replace("task://", "");
              const t = tasks.find((t) => t.id === id);
              if (t) {
                label = `Task: ${t.title}`;
              } else if (taskCache[id]) {
                if (taskCache[id].startsWith("Unknown")) {
                  label = "Error: Task not found";
                  isError = true;
                } else {
                  label = `Task: ${taskCache[id]}`;
                }
              } else {
                label = "Task: Loading title...";
              }
            }

            return (
              <div
                className={`absolute z-50 text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap animate-in fade-in zoom-in duration-200 border ${
                  isError
                    ? "bg-red-600 border-red-400 font-bold"
                    : "bg-gray-900 border-gray-700"
                }`}
                style={{
                  top: (tooltip.rect.bottom || 0) + 5,
                  left: Math.max(10, tooltip.rect.left || 0),
                }}
              >
                {label}
              </div>
            );
          })()}
      </div>
    );
  }),
  () => true, // Never re-render!
);

function MarkdownLink({
  href,
  children,
  currentOrgId,
  pages,
}: {
  href?: string;
  children: React.ReactNode;
  currentOrgId: string;
  pages: WikiPageSummaryDto[];
}) {
  if (!href) return <span>{children}</span>;

  // Wiki links
  let wikiPageId: string | null = null;
  let matchedProjectId = "";
  if (href.startsWith("wiki://")) {
    wikiPageId = href.replace("wiki://", "");
    const page = pages.find((p) => p.id === wikiPageId);
    if (page) matchedProjectId = page.projectId || "";
  } else {
    const wikiMatch = href.match(
      /\/orgs\/([^/]+)\/projects\/([^/]+)\/wiki\/([^/]+)/,
    );
    if (wikiMatch) {
      const [, matchedOrgId, projId, pageId] = wikiMatch;
      if (matchedOrgId === currentOrgId) {
        wikiPageId = pageId;
        matchedProjectId = projId;
      } else
        return (
          <span
            className="opacity-50 cursor-not-allowed"
            title="External Organization"
          >
            {children}
          </span>
        );
    }
  }

  if (wikiPageId) {
    const exists = pages.some((p) => p.id === wikiPageId);
    const realHref = matchedProjectId
      ? `/orgs/${currentOrgId}/projects/${matchedProjectId}/wiki/${wikiPageId}`
      : href;

    const handleClick = (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey) return; // Allow new tab
      e.preventDefault();
      if (!exists) {
        alert(`Wiki page does not exist: ${wikiPageId}`);
        return;
      }
      window.dispatchEvent(
        new CustomEvent("kanban_open_wiki_page", { detail: wikiPageId }),
      );
    };

    return (
      <a
        href={realHref}
        onClick={handleClick}
        className="text-blue-600 hover:underline cursor-pointer"
      >
        {children}
      </a>
    );
  }

  // Task links
  let taskId: string | null = null;
  let taskProjectId = "";
  if (href.startsWith("task://")) {
    taskId = href.replace("task://", "");
  } else {
    const taskMatch = href.match(
      /\/orgs\/([^/]+)\/projects\/([^/]+)\/tasks\/([^/]+)/,
    );
    if (taskMatch) {
      const [, matchedOrgId, projId, tid] = taskMatch;
      if (matchedOrgId === currentOrgId) {
        taskId = tid;
        taskProjectId = projId;
      } else
        return (
          <span
            className="opacity-50 cursor-not-allowed"
            title="External Organization"
          >
            {children}
          </span>
        );
    }
  }

  if (taskId) {
    const realHref = taskProjectId
      ? `/orgs/${currentOrgId}/projects/${taskProjectId}?taskId=${taskId}`
      : href;

    const handleClick = (e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey) return; // Allow new tab
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent("kanban_tab_changed", { detail: "board" }),
      );
      window.dispatchEvent(
        new CustomEvent("kanban_open_task", { detail: taskId }),
      );
    };

    return (
      <a
        href={realHref}
        onClick={handleClick}
        className="text-blue-600 hover:underline cursor-pointer"
      >
        {children}
      </a>
    );
  }

  // External links
  const isExternal = href.startsWith("http");
  if (isExternal) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return <a href={href}>{children}</a>;
}

interface Props {
  pageId: string;
  orgId: string;
  projectId: string;
  tasks?: TaskDto[];
}

export function WikiEditor({ pageId, orgId, tasks = [] }: Props) {
  const {
    pages,
    pageModes,
    setPageMode,
    pageContents,
    setPageContent,
    pageProperties,
    setPageProperties,
  } = useWiki();
  const page = pages.find((p) => p.id === pageId);
  const mode = pageModes[pageId] || "view";
  const content = pageContents[pageId] || "";
  const properties = pageProperties[pageId] || {};

  const [status, setStatus] = useState<SaveStatus>("saved");
  const [showProperties, setShowProperties] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const [linkModalType, setLinkModalType] = useState<"link" | "wiki" | "task">(
    "link",
  );
  const [savedSelectionRange, setSavedSelectionRange] = useState<{
    start: number;
    end: number;
  } | null>(null);
  // Incremented only on remote collaborative updates → triggers cursor restore
  const [restoreTrigger, setRestoreTrigger] = useState(0);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const visualRef = useRef<VisualEditorRef>(null);
  const isRemoteUpdateRef = useRef(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const remoteCursorRef = useRef<{ start: number; end: number } | null>(null);
  // Track if we've passed the very first initialHtml to VisualEditor
  const initializedVisualRef = useRef(false);

  // ── Fetch on mount ────────────────────────────────────────────────────────
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

  // ── Sync contenteditable on initial render, fetch complete, and mode switch ──
  useEffect(() => {
    if (mode === "visual" && visualRef.current) {
      // If we haven't initialized it yet, OR we just switched to it
      // wait, because the component doesn't re-render, if it mounts it gets initialHtml.
      // But if we just fetched content, we need to push it in.
      const currentHtml = visualRef.current.getHtml();
      if (!currentHtml && content) {
        visualRef.current.setHtml(marked(content) as string);
        initializedVisualRef.current = true;
      }
    }
  }, [mode, content]);

  // ── Restore textarea cursor — fires ONLY on remote updates (restoreTrigger) ──
  // Using useLayoutEffect (sync, before paint) avoids the async RAF race condition.
  useLayoutEffect(() => {
    if (restoreTrigger === 0) return;
    if (remoteCursorRef.current && textareaRef.current) {
      const { start, end } = remoteCursorRef.current;
      remoteCursorRef.current = null;
      textareaRef.current.setSelectionRange(start, end);
    }
  }, [restoreTrigger]);

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = useCallback(
    async (val: string, props?: Record<string, unknown>) => {
      if (!val && !props) return;
      setStatus("saving");
      try {
        const result = await updateWikiPageAction(pageId, {
          content: val,
          properties: props,
        });
        if (result.error) {
          throw new Error(result.error);
        }
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

  // ── Keyboard shortcut ─────────────────────────────────────────────────────
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

  // ── WebSocket collaboration ───────────────────────────────────────────────
  const { ws, isConnected, tabId } = useWikiSocket(orgId, {
    onYjsUpdate: (
      receivedPageId,
      rawContent,
      rawProperties,
      _actorId,
      msgTabId,
    ) => {
      if (receivedPageId !== pageId || msgTabId === tabId) return;

      // Update properties if provided
      if (rawProperties) {
        setPageProperties(pageId, rawProperties);
      }

      if (rawContent !== undefined) {
        // Snapshot textarea cursor, then trigger synchronous restore via useLayoutEffect
        if (textareaRef.current) {
          remoteCursorRef.current = {
            start: textareaRef.current.selectionStart,
            end: textareaRef.current.selectionEnd,
          };
        }
        // Update visual contenteditable imperatively
        if (visualRef.current) {
          isRemoteUpdateRef.current = true;
          visualRef.current.setHtml(marked(rawContent) as string);
          isRemoteUpdateRef.current = false;
        }
        setPageContent(pageId, rawContent);
        setRestoreTrigger((n) => n + 1);
      }
      setStatus("saved");
    },
  });

  const broadcast = useCallback(
    (val?: string, props?: Record<string, unknown>) => {
      if (ws && isConnected) {
        ws.send(
          JSON.stringify({
            type: "wiki.yjs_update",
            room: `org:${orgId}`,
            pageId,
            update: val,
            properties: props,
            tabId,
          }),
        );
      }
    },
    [ws, isConnected, orgId, pageId, tabId],
  );

  // ── Textarea change handler (Edit / Split) ────────────────────────────────
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPageContent(pageId, val);
    setStatus("unsaved");
    broadcast(val);
    scheduleSave(val);
  };

  // ── Visual (contenteditable) input handler ────────────────────────────────
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
      {/* ── Top bar ── */}
      <div className="flex-none h-12 border-b border-gray-100 bg-white px-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-5">
          {/* Live indicator */}
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${isConnected ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]" : "bg-red-400"}`}
            />
            <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">
              {isConnected ? "Live" : "Offline"}
            </span>
          </div>
          {/* 3-state save */}
          <div className="flex items-center gap-2 bg-gray-50 px-3 py-1 rounded-full border border-gray-100">
            <div
              className={`w-2 h-2 rounded-full transition-colors ${
                status === "saving"
                  ? "bg-blue-500 animate-pulse"
                  : status === "unsaved"
                    ? "bg-amber-400"
                    : "bg-gray-300"
              }`}
            />
            <span
              className={`text-[9px] font-black uppercase tracking-widest ${
                status === "saving"
                  ? "text-blue-500"
                  : status === "unsaved"
                    ? "text-amber-600"
                    : "text-gray-400"
              }`}
            >
              {status === "saving"
                ? "Saving"
                : status === "unsaved"
                  ? "Unsaved"
                  : "Saved"}
            </span>
          </div>
        </div>

        {/* Mode switcher */}
        <div className="flex items-center bg-gray-50 p-1 rounded-xl border border-gray-100">
          {(["view", "visual", "edit", "split"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setPageMode(pageId, m)}
              className={`px-4 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all capitalize ${
                mode === m
                  ? "bg-white text-blue-600 shadow-sm border border-gray-100"
                  : "text-gray-400 hover:text-gray-600"
              }`}
            >
              {m}
            </button>
          ))}
        </div>

        <button
          onClick={() => setShowProperties(!showProperties)}
          className={`px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all ${
            showProperties
              ? "bg-blue-50 text-blue-600 border border-blue-100"
              : "bg-gray-50 text-gray-400 border border-gray-100 hover:text-gray-600"
          }`}
        >
          {showProperties ? "Hide Details" : "Details"}
        </button>
      </div>

      {/* ── Formatting toolbar (Visual + Edit) ── */}
      {(mode === "visual" || mode === "edit") && (
        <div className="flex-none border-b border-gray-100 bg-gray-50/60 px-3 py-1.5 flex items-center gap-0.5 flex-wrap shrink-0">
          {TOOLBAR_ITEMS.map((btn, i) => {
            if (btn.label === "|")
              return <div key={i} className="w-px h-5 bg-gray-200 mx-1.5" />;
            return (
              <button
                key={i}
                title={btn.title}
                onMouseDown={(e) => {
                  e.preventDefault(); // preserve focus
                  if (mode === "visual") {
                    if (btn.special) {
                      setSavedSelectionRange(
                        saveSelection(
                          visualRef.current?.getEl() as HTMLElement,
                        ),
                      );
                      setLinkModalType(btn.special as "link" | "wiki" | "task");
                      setIsLinkModalOpen(true);
                      return;
                    }

                    // execCommand for contenteditable
                    if (btn.execCmd) {
                      document.execCommand(
                        btn.execCmd,
                        false,
                        btn.execArg ?? undefined,
                      );
                      // Trigger input handler to sync back to markdown
                      setTimeout(handleVisualInput, 0);
                    }
                  } else {
                    // Markdown injection for textarea
                    const ta = textareaRef.current;
                    if (!ta) return;

                    if (btn.special) {
                      setLinkModalType(btn.special as "link" | "wiki" | "task");
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
                    requestAnimationFrame(() =>
                      ta.setSelectionRange(start, end),
                    );
                  }
                }}
                className="px-2 py-1 rounded-md text-gray-500 hover:text-gray-900 hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all select-none"
              >
                <span className={btn.className ?? "text-sm"}>{btn.label}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* ── Editor surface ── */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Visual: contenteditable WYSIWYG */}
        {mode === "visual" && (
          <VisualEditor
            ref={visualRef}
            initialHtml={content ? (marked(content) as string) : ""}
            onInputRef={handleVisualInputRef}
            pages={pages}
            tasks={tasks}
          />
        )}

        {/* Edit: raw markdown textarea */}
        {mode === "edit" && (
          <textarea
            ref={textareaRef}
            value={content}
            onChange={handleTextareaChange}
            disabled={isFetching}
            className="w-full h-full p-10 font-mono text-sm leading-relaxed resize-none focus:outline-none bg-white placeholder-gray-200"
            placeholder="# Start writing in Markdown..."
          />
        )}

        {/* Split: textarea left + preview right */}
        {mode === "split" && (
          <>
            <div className="flex-1 h-full border-r border-gray-100">
              <textarea
                ref={textareaRef}
                value={content}
                onChange={handleTextareaChange}
                disabled={isFetching}
                className="w-full h-full p-10 font-mono text-sm leading-relaxed resize-none focus:outline-none bg-white placeholder-gray-200"
                placeholder="# Start writing in Markdown..."
              />
            </div>
            <div className="flex-1 h-full overflow-y-auto bg-white p-10 prose prose-slate max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-pre:bg-gray-900 prose-pre:rounded-xl">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                urlTransform={(url) => url}
                components={{
                  a: ({ href, children }) => (
                    <MarkdownLink
                      href={href}
                      currentOrgId={orgId}
                      pages={pages}
                    >
                      {children}
                    </MarkdownLink>
                  ),
                }}
              >
                {content || "_Start writing on the left..._"}
              </ReactMarkdown>
            </div>
          </>
        )}

        {/* View: simply display content */}
        {mode === "view" && (
          <div className="flex-1 h-full overflow-y-auto bg-white p-10 prose prose-slate max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-pre:bg-gray-900 prose-pre:rounded-xl">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              urlTransform={(url) => url}
              components={{
                a: ({ href, children }) => (
                  <MarkdownLink href={href} currentOrgId={orgId} pages={pages}>
                    {children}
                  </MarkdownLink>
                ),
              }}
            >
              {content || "_No content yet._"}
            </ReactMarkdown>
          </div>
        )}

        {showProperties && (
          <WikiPropertiesPanel
            properties={properties}
            onChange={handlePropertiesChange}
            readOnly={mode === "view"}
          />
        )}

        <LinkModal
          isOpen={isLinkModalOpen}
          onClose={() => setIsLinkModalOpen(false)}
          type={linkModalType}
          pages={pages}
          orgId={orgId}
          onSelect={(href, title) => {
            setIsLinkModalOpen(false);
            if (mode === "visual") {
              const el = visualRef.current?.getEl();
              if (el) {
                el.focus();
                restoreSelection(el, savedSelectionRange);
                document.execCommand("createLink", false, href);
                setTimeout(handleVisualInput, 0);
              }
            } else {
              const ta = textareaRef.current;
              if (!ta) return;
              const selection = content.slice(
                ta.selectionStart,
                ta.selectionEnd,
              );
              const linkText = selection || title || "link";
              const linkMd = `[${linkText}](${href})`;
              const finalContent =
                content.slice(0, ta.selectionStart) +
                linkMd +
                content.slice(ta.selectionEnd);
              const finalStart = ta.selectionStart + linkMd.length;

              setPageContent(pageId, finalContent);
              setStatus("unsaved");
              broadcast(finalContent);
              scheduleSave(finalContent);
              requestAnimationFrame(() =>
                ta.setSelectionRange(finalStart, finalStart),
              );
            }
          }}
        />
      </div>
    </div>
  );
}
