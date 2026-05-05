"use client";

import {
  useState,
  useRef,
  useCallback,
  useEffect,
  createContext,
  useContext,
  useMemo,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useParams } from "next/navigation";
import { createPortal } from "react-dom";
import { useWiki } from "@/context/WikiContext";
import { LinkModal } from "@/components/LinkModal";
import { searchTasksInOrgAction, getTaskByIdAction } from "@/actions/tasks";
import { getWikiPageAction } from "@/actions/wiki";
import type { TaskDto, WikiPageDto, WikiPageSummaryDto } from "@kanban/shared";

// ── Cache (Singleton for performance) ─────────────────────────────────────────
const taskCache = new Map<string, TaskDto>();
const pendingTaskRequests = new Map<
  string,
  Promise<{ task?: TaskDto; error?: string }>
>();

async function getTaskCached(taskId: string) {
  if (taskCache.has(taskId)) return { task: taskCache.get(taskId) };
  if (pendingTaskRequests.has(taskId)) return pendingTaskRequests.get(taskId);

  const request = getTaskByIdAction(taskId).then((res) => {
    if (res.task) taskCache.set(taskId, res.task);
    pendingTaskRequests.delete(taskId);
    return res;
  });

  pendingTaskRequests.set(taskId, request);
  return request;
}

const wikiCache = new Map<string, WikiPageDto>();
const pendingWikiRequests = new Map<
  string,
  Promise<{ page?: WikiPageDto; error?: string }>
>();

async function getWikiCached(pageId: string) {
  if (wikiCache.has(pageId)) return { page: wikiCache.get(pageId) };
  if (pendingWikiRequests.has(pageId)) return pendingWikiRequests.get(pageId);

  const request = getWikiPageAction(pageId).then((res) => {
    if (res.page) wikiCache.set(pageId, res.page);
    pendingWikiRequests.delete(pageId);
    return res;
  });

  pendingWikiRequests.set(pageId, request);
  return request;
}

// ── Context ──────────────────────────────────────────────────────────────────

interface DescriptionEditorContextType {
  onOpenTask?: (taskId: string) => void;
}

const DescriptionEditorContext = createContext<DescriptionEditorContextType>(
  {},
);

// ── Toolbar ───────────────────────────────────────────────────────────────────

type ToolItem =
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

const TOOLBAR: ToolItem[] = [
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

function applyToolbar(
  textarea: HTMLTextAreaElement,
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

// ── Sub-components ────────────────────────────────────────────────────────────

function TaskLink({
  taskId,
  children,
}: {
  taskId: string;
  children: React.ReactNode;
}) {
  const params = useParams();
  const currentProjectId = params.projectId as string;
  const [task, setTask] = useState<TaskDto | null>(null);
  const [error, setError] = useState(false);
  const { onOpenTask } = useContext(DescriptionEditorContext);

  useEffect(() => {
    if (!taskId) return;
    void getTaskCached(taskId).then((res) => {
      if (res && res.task) setTask(res.task);
      else if (res && res.error) setError(true);
    });
  }, [taskId]);

  const isOtherProject = task && task.projectId !== currentProjectId;

  // Color logic
  let bgColor = "bg-blue-50 hover:bg-blue-100 border-blue-100 text-blue-700";
  if (error)
    bgColor = "bg-red-50 border-red-100 text-red-500 cursor-not-allowed";
  else if (isOtherProject)
    bgColor =
      "bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700";

  return (
    <button
      type="button"
      disabled={error}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onOpenTask) onOpenTask(taskId);
      }}
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[13px] font-medium transition-colors border ${bgColor}`}
    >
      <span className="text-[10px] opacity-70">#</span>
      {error ? (
        <span className="flex items-center gap-1 uppercase text-[10px] font-bold">
          <s>{children}</s>
          <span className="text-[10px] font-bold">DELETED</span>
        </span>
      ) : (
        task?.title || children
      )}
    </button>
  );
}

function WikiLink({
  pageId,
  children,
}: {
  pageId: string;
  children: React.ReactNode;
}) {
  const [page, setPage] = useState<WikiPageDto | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!pageId) return;
    void getWikiCached(pageId).then((res) => {
      if (res && res.page) setPage(res.page);
      else if (res && res.error) setError(true);
    });
  }, [pageId]);

  return (
    <button
      type="button"
      disabled={error}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        // Switch to wiki tab
        window.dispatchEvent(
          new CustomEvent("kanban_tab_changed", { detail: "wiki" }),
        );
        // Open the page
        window.dispatchEvent(
          new CustomEvent("kanban_open_wiki_page", { detail: pageId }),
        );
      }}
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[13px] font-medium transition-colors border ${
        error
          ? "bg-red-50 border-red-100 text-red-500 cursor-not-allowed"
          : "bg-purple-50 hover:bg-purple-100 border-purple-100 text-purple-700"
      }`}
    >
      <span className="text-[10px] opacity-70 italic font-serif">W</span>
      {error ? (
        <span className="flex items-center gap-1 uppercase text-[10px] font-bold">
          <s>{children}</s>
          <span className="text-[10px] font-bold text-red-600">NOT FOUND</span>
        </span>
      ) : (
        page?.title || children
      )}
    </button>
  );
}

function Preview({
  value,
  placeholder,
}: {
  value: string;
  placeholder: string;
}) {
  const mdComponents = useMemo<
    React.ComponentProps<typeof ReactMarkdown>["components"]
  >(
    () => ({
      code({ className, children, ...props }) {
        const match = /language-(\w+)/.exec(className ?? "");
        const isInline = !className;
        if (!isInline && match) {
          return (
            <SyntaxHighlighter
              style={oneLight}
              language={match[1]}
              PreTag="div"
              customStyle={{
                borderRadius: "0.375rem",
                fontSize: "0.78rem",
                margin: "0.5rem 0",
              }}
            >
              {String(children as string).replace(/\n$/, "")}
            </SyntaxHighlighter>
          );
        }
        return (
          <code
            className="text-pink-600 bg-gray-100 px-1 rounded text-xs"
            {...props}
          >
            {children}
          </code>
        );
      },
      a({ href, children, ...props }) {
        // 1. Get raw info and decode safely
        const rawHref = href || "";
        const decodedHref = decodeURIComponent(rawHref);

        // 2. Extract UUID for tasks
        const taskUuidMatch = decodedHref.match(
          /task:(?:[^/]*\/)?([0-9a-fA-F-]{36})/,
        );
        const taskId =
          taskUuidMatch?.[1] ||
          (decodedHref.startsWith("task://")
            ? decodedHref.replace("task://", "")
            : null);
        const isTaskLink =
          !!taskId &&
          (decodedHref.includes("task:") || decodedHref.startsWith("task://"));

        // 3. Detect wiki protocol
        const wikiIdMatch = decodedHref.match(
          /wiki:(?:[^/]*\/)?([0-9a-fA-F-]{36})/,
        );
        const pageId =
          wikiIdMatch?.[1] ||
          (decodedHref.startsWith("wiki://")
            ? decodedHref.replace("wiki://", "")
            : null);
        const isWikiLink =
          !!pageId &&
          (decodedHref.includes("wiki:") || decodedHref.startsWith("wiki://"));

        if (isTaskLink && taskId) {
          return <TaskLink taskId={taskId}>{children}</TaskLink>;
        }

        if (isWikiLink && pageId) {
          return <WikiLink pageId={pageId}>{children}</WikiLink>;
        }

        // Everything else is a plain link
        const isExternal =
          rawHref.startsWith("http") &&
          !rawHref.includes(
            typeof window !== "undefined" ? window.location.hostname : "",
          );

        return (
          <a
            href={rawHref}
            className="text-blue-600 hover:underline"
            target={isExternal ? "_blank" : "_self"}
            rel="noopener noreferrer"
            {...props}
          >
            {children}
          </a>
        );
      },
    }),
    [],
  );

  return value ? (
    <div className="prose prose-sm max-w-none text-gray-700 prose-headings:mt-3 prose-headings:mb-1 prose-p:my-1 prose-li:my-0 prose-pre:p-0 prose-pre:bg-transparent prose-code:before:content-none prose-code:after:content-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={mdComponents}
        urlTransform={(uri) => uri} // CRITICAL: For ReactMarkdown v8/v9
      >
        {value}
      </ReactMarkdown>
    </div>
  ) : (
    <span className="text-gray-400 text-sm">{placeholder}</span>
  );
}

function Toolbar({
  textareaRef,
  onChange,
  showPreview,
  onTogglePreview,
  onLink,
  extra,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (v: string) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
  onLink: (type: "link" | "wiki" | "task") => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1 shrink-0">
      {TOOLBAR.map((item, i) =>
        item.type === "divider" ? (
          <div key={i} className="w-px h-3.5 bg-gray-300 mx-0.5" />
        ) : (
          <button
            key={item.title}
            type="button"
            title={item.title}
            onMouseDown={(e) => {
              e.preventDefault();
              if (item.title === "Wiki Link") {
                onLink("wiki");
              } else if (item.title === "Task Link") {
                onLink("task");
              } else if (item.title === "External Link") {
                onLink("link");
              } else if (textareaRef.current) {
                onChange(applyToolbar(textareaRef.current, item));
              }
            }}
            className="px-1.5 py-0.5 text-xs rounded hover:bg-gray-200 text-gray-600 font-mono leading-none"
          >
            {item.icon}
          </button>
        ),
      )}
      <div className="flex-1" />
      <button
        type="button"
        onClick={onTogglePreview}
        className={`px-2 py-0.5 text-xs rounded ${showPreview ? "bg-blue-100 text-blue-700 font-medium" : "hover:bg-gray-200 text-gray-500"}`}
      >
        Preview
      </button>
      {extra}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  onFocus: _onFocus,
  onBlur,
  placeholder = "Add a description…",
  onOpenTask,
}: Props) {
  const params = useParams();
  const orgId = params.orgId as string;
  const [isEditing, setIsEditing] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { pages } = useWiki();
  const wikiModalOpenRef = useRef(false);
  const [wikiModalType, setWikiModalType] = useState<"link" | "wiki" | "task">(
    "wiki",
  );
  const [wikiModalOpen, _setWikiModalOpen] = useState(false);
  const setWikiModalOpen = useCallback((val: boolean) => {
    wikiModalOpenRef.current = val;
    _setWikiModalOpen(val);
  }, []);
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionType, setMentionType] = useState<"task" | "wiki">("task");
  const [mentionResults, setMentionResults] = useState<
    (TaskDto | WikiPageSummaryDto)[]
  >([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCoords, setMentionCoords] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fullScreenContainerRef = useRef<HTMLDivElement>(null);
  const isEditingRef = useRef(isEditing);
  const latestValueRef = useRef(value);

  useEffect(() => {
    isEditingRef.current = isEditing;
  }, [isEditing]);

  useEffect(() => {
    latestValueRef.current = value;
  }, [value]);

  const onBlurRef = useRef(onBlur);
  useEffect(() => {
    onBlurRef.current = onBlur;
  }, [onBlur]);

  useEffect(() => {
    return () => {
      if (isEditingRef.current) {
        onBlurRef.current(latestValueRef.current);
      }
    };
  }, []); // Run ONLY on unmount

  // ── MENTIONS (@ for tasks, [[ for wiki) ──────────────────────────────────────
  const wikiMentionResults = useMemo(() => {
    if (mentionSearch === null || mentionType !== "wiki") return [];
    return pages
      .filter((p) =>
        p.title.toLowerCase().includes(mentionSearch.toLowerCase()),
      )
      .slice(0, 8);
  }, [mentionSearch, mentionType, pages]);

  const [prevMentionSearch, setPrevMentionSearch] = useState(mentionSearch);
  if (mentionSearch !== prevMentionSearch) {
    setPrevMentionSearch(mentionSearch);
    if (mentionSearch === null && mentionResults.length > 0) {
      setMentionResults([]);
    }
  }

  useEffect(() => {
    if (mentionSearch === null) return;

    if (mentionType === "task") {
      const timer = setTimeout(async () => {
        const res = await searchTasksInOrgAction(orgId, mentionSearch);
        if (res.tasks) {
          setMentionResults(res.tasks.slice(0, 8));
          setMentionIndex(0);
        }
      }, 200);
      return () => clearTimeout(timer);
    } else {
      void Promise.resolve().then(() => setMentionIndex(0));
    }
  }, [mentionSearch, mentionType, orgId, setMentionResults, setMentionIndex]);

  const activeResults =
    mentionType === "task" ? mentionResults : wikiMentionResults;

  const insertMention = (item: TaskDto | WikiPageSummaryDto) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const text = textarea.value;

    let triggerPos = -1;
    let mention = "";

    if (mentionType === "task") {
      triggerPos = text.lastIndexOf("@", start - 1);
      mention = `[#${item.title}](task:${item.id})`;
    } else {
      triggerPos = text.lastIndexOf("[[", start - 1);
      mention = `[${item.title}](wiki:${item.id})`;
    }

    if (triggerPos === -1) return;

    const newVal =
      text.slice(0, triggerPos) + mention + " " + text.slice(start);
    onChange(newVal);
    setMentionSearch(null);

    const newPos = triggerPos + mention.length + 1;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionSearch !== null && activeResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % activeResults.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + activeResults.length) % activeResults.length,
        );
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(activeResults[mentionIndex]);
        return;
      }
      if (e.key === "Escape") {
        setMentionSearch(null);
        return;
      }
    }
  };

  const handleTextareaChange = (val: string) => {
    onChange(val);
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const pos = textarea.selectionStart;
    const text = val.slice(0, pos);

    // Check for @ (Task)
    const lastAt = text.lastIndexOf("@");
    if (lastAt !== -1 && !text.slice(lastAt).includes(" ")) {
      setMentionSearch(text.slice(lastAt + 1));
      setMentionType("task");
      const rect = textarea.getBoundingClientRect();
      setMentionCoords({
        top: rect.top + 20,
        left: rect.left + 20,
      });
      return;
    }

    // Check for [[ (Wiki)
    const lastBracket = text.lastIndexOf("[[");
    if (
      lastBracket !== -1 &&
      !text.slice(lastBracket).includes(" ") &&
      !text.slice(lastBracket).includes("\n")
    ) {
      setMentionSearch(text.slice(lastBracket + 2));
      setMentionType("wiki");
      const rect = textarea.getBoundingClientRect();
      setMentionCoords({
        top: rect.top + 20,
        left: rect.left + 20,
      });
      return;
    }

    setMentionSearch(null);
  };

  const startEditing = () => {
    setIsEditing(true);
    setShowPreview(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
    _onFocus();
  };

  const finishEditing = () => {
    setIsEditing(false);
    onBlur(value);
    setMentionSearch(null);
  };

  function handleTextareaBlur() {
    // delay to allow clicks on toolbar or modals
    setTimeout(() => {
      // If modal is open, DON'T close the editor
      if (wikiModalOpenRef.current) return;

      const active = document.activeElement;

      // If focus is still within our container or fullscreen container, stay in edit mode
      if (containerRef.current?.contains(active)) return;
      if (fullScreenContainerRef.current?.contains(active)) return;

      // Special case: if we are in fullscreen and just clicked something that isn't inside,
      // it might be because the portal content changed or we are truly blurring.
      // If we are in fullscreen, we usually only blur if we click the close button or navigate.

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

  const renderMentionList = () => {
    if (mentionSearch === null || activeResults.length === 0) return null;
    return createPortal(
      <div
        className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden w-72 max-h-60 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200"
        style={{ left: mentionCoords.left, top: mentionCoords.top }}
      >
        <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            {mentionType === "task" ? "Mention Task" : "Mention Wiki Page"}
          </span>
        </div>
        <div className="overflow-y-auto py-1">
          {activeResults.map((t, i) => (
            <button
              key={t.id}
              onMouseDown={(e) => {
                e.preventDefault();
                insertMention(t);
              }}
              className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors ${i === mentionIndex ? "bg-blue-50" : "hover:bg-gray-50"}`}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-900 truncate">
                  {t.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400 font-mono">
                    {mentionType === "task" ? "#" : "w/"}
                    {mentionType === "task"
                      ? t.id.slice(0, 6)
                      : "slug" in t
                        ? t.slug
                        : ""}
                  </span>
                  {mentionType === "task" &&
                    "projectName" in t &&
                    t.projectName && (
                      <span className="text-[10px] px-1 bg-gray-100 text-gray-500 rounded uppercase">
                        {t.projectName}
                      </span>
                    )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>,
      document.body,
    );
  };

  if (isFullscreen) {
    return createPortal(
      <DescriptionEditorContext.Provider value={{ onOpenTask }}>
        <div
          ref={fullScreenContainerRef}
          className="fixed inset-0 z-[99999] flex flex-col bg-white"
        >
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
            <span className="text-sm font-semibold text-gray-700 font-mono">
              DESCRIPTION_FULLSCREEN_MODE
            </span>
            <button
              onClick={() => {
                setIsFullscreen(false);
                onBlur(value);
              }}
              className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <span className="text-2xl leading-none">×</span>
            </button>
          </div>
          <Toolbar
            textareaRef={textareaRef}
            onChange={onChange}
            showPreview={showPreview}
            onTogglePreview={() => setShowPreview(!showPreview)}
            onLink={(type) => {
              setWikiModalType(type);
              setWikiModalOpen(true);
            }}
            extra={
              <button
                onClick={() => {
                  setIsFullscreen(false);
                  onBlur(value);
                }}
                className="ml-2 px-4 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm transition-all active:scale-95 font-medium"
              >
                Exit Fullscreen
              </button>
            }
          />
          <LinkModal
            isOpen={wikiModalOpen}
            onClose={() => {
              setWikiModalOpen(false);
              setTimeout(() => textareaRef.current?.focus(), 0);
            }}
            type={wikiModalType}
            pages={pages}
            orgId={orgId}
            onSelect={(href, title) => {
              if (!textareaRef.current) return;
              const textarea = textareaRef.current;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const insertion = `[${title || (wikiModalType === "link" ? href : "Link")}](${href})`;
              const newVal =
                value.slice(0, start) + insertion + value.slice(end);
              onChange(newVal);
              setWikiModalOpen(false);
              setTimeout(() => {
                textarea.focus();
                const newPos = start + insertion.length;
                textarea.setSelectionRange(newPos, newPos);
              }, 0);
            }}
          />
          <div className="flex-1 overflow-hidden flex flex-col px-6 py-6 max-w-5xl mx-auto w-full">
            {showPreview ? (
              <div className="flex-1 overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-gray-200">
                <Preview value={value} placeholder={placeholder} />
              </div>
            ) : (
              <div className="h-full relative flex flex-col bg-gray-50/30 rounded-lg p-2 border border-gray-100/50">
                <textarea
                  ref={textareaRef}
                  value={value}
                  onChange={(e) => handleTextareaChange(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onBlur={handleTextareaBlur}
                  autoFocus
                  placeholder={placeholder}
                  className="flex-1 w-full text-base text-gray-800 focus:outline-none resize-none bg-transparent px-4 py-2"
                  style={{ lineHeight: "1.6" }}
                />
                {renderMentionList()}
              </div>
            )}
          </div>
        </div>
      </DescriptionEditorContext.Provider>,
      document.body,
    );
  }

  if (!isEditing) {
    return (
      <DescriptionEditorContext.Provider value={{ onOpenTask }}>
        <div className="group relative">
          <div className="min-h-[60px] rounded border border-transparent hover:border-gray-200 px-2 py-1.5">
            <Preview value={value} placeholder={placeholder} />
          </div>
          <div className="absolute top-1 right-1 hidden group-hover:flex items-center gap-1">
            <button
              onClick={startEditing}
              className="px-1.5 py-0.5 text-xs bg-white border border-gray-200 rounded text-gray-500 shadow-sm"
            >
              Edit
            </button>
            <button
              onClick={toggleFullscreen}
              className="px-1.5 py-0.5 text-xs bg-white border border-gray-200 rounded text-gray-500 shadow-sm"
            >
              ⤢
            </button>
          </div>
        </div>
      </DescriptionEditorContext.Provider>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative flex flex-col transition-all overflow-hidden ${isEditing ? "bg-white border border-gray-200 rounded-lg shadow-sm" : "min-h-[2.5rem]"}`}
    >
      <DescriptionEditorContext.Provider value={{ onOpenTask }}>
        <Toolbar
          textareaRef={textareaRef}
          onChange={onChange}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview(!showPreview)}
          onLink={(type) => {
            setWikiModalType(type);
            setWikiModalOpen(true);
          }}
          extra={
            <button
              onClick={toggleFullscreen}
              title="Toggle fullscreen"
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              ↗
            </button>
          }
        />
        <LinkModal
          isOpen={wikiModalOpen}
          onClose={() => {
            setWikiModalOpen(false);
            setTimeout(() => textareaRef.current?.focus(), 0);
          }}
          type={wikiModalType}
          pages={pages}
          orgId={orgId}
          onSelect={(href, title) => {
            if (!textareaRef.current) return;
            const textarea = textareaRef.current;
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const insertion = `[${title || (wikiModalType === "link" ? href : "Link")}](${href})`;
            const newVal = value.slice(0, start) + insertion + value.slice(end);
            onChange(newVal);
            setWikiModalOpen(false);
            setTimeout(() => {
              textarea.focus();
              const newPos = start + insertion.length;
              textarea.setSelectionRange(newPos, newPos);
            }, 0);
          }}
        />
        <div className="relative flex flex-col min-h-[8rem] px-3 py-3">
          {showPreview ? (
            <div className="flex-1">
              <Preview value={value} placeholder={placeholder} />
            </div>
          ) : (
            <>
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => handleTextareaChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onBlur={handleTextareaBlur}
                placeholder={placeholder}
                className="flex-1 w-full text-sm text-gray-700 outline-none resize-none min-h-[6rem] bg-transparent"
              />
              {renderMentionList()}
            </>
          )}
        </div>
        <div className="px-3 py-1.5 border-t border-gray-50 bg-gray-50/30">
          <span className="text-[10px] text-gray-400 font-mono italic">
            Markdown supported • Use @ to mention tasks, [[ for wiki
          </span>
        </div>
      </DescriptionEditorContext.Provider>
    </div>
  );
}
