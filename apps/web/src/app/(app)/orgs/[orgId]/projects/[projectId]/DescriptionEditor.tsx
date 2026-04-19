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
import { searchTasksInOrgAction, getTaskByIdAction } from "@/actions/tasks";
import type { TaskDto } from "@kanban/shared";

// ── Task Cache (Singleton for performance) ────────────────────────────────────
const taskCache = new Map<string, TaskDto>();
const pendingRequests = new Map<
  string,
  Promise<{ task?: TaskDto; error?: string }>
>();

async function getTaskCached(taskId: string) {
  if (taskCache.has(taskId)) return { task: taskCache.get(taskId) };
  if (pendingRequests.has(taskId)) return pendingRequests.get(taskId);

  const request = getTaskByIdAction(taskId).then((res) => {
    if (res.task) taskCache.set(taskId, res.task);
    pendingRequests.delete(taskId);
    return res;
  });

  pendingRequests.set(taskId, request);
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

        // 2. Extract UUID
        const uuidMatch = decodedHref.match(/([0-9a-fA-F-]{36})/);
        const taskId = uuidMatch?.[1];

        // 3. Detect task protocol (very permissive to catch resolved URLs)
        const isTaskLink = !!taskId && decodedHref.includes("task:");

        if (isTaskLink && taskId) {
          return <TaskLink taskId={taskId}>{children}</TaskLink>;
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
  extra,
}: {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onChange: (v: string) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1 shrink-0">
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
              if (textareaRef.current)
                onChange(applyToolbar(textareaRef.current, item));
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
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionResults, setMentionResults] = useState<TaskDto[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCoords, setMentionCoords] = useState<{
    top: number;
    left: number;
  }>({ top: 0, left: 0 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (mentionSearch === null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMentionResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      const res = await searchTasksInOrgAction(orgId, mentionSearch);
      if (res.tasks) {
        setMentionResults(res.tasks.slice(0, 8));
        setMentionIndex(0);
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [mentionSearch, orgId]);

  const insertMention = (targetTask: TaskDto) => {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const text = textarea.value;
    const lastAt = text.lastIndexOf("@", start - 1);
    if (lastAt === -1) return;

    const mention = `[#${targetTask.title}](task:${targetTask.id})`;
    const newVal = text.slice(0, lastAt) + mention + " " + text.slice(start);
    onChange(newVal);
    setMentionSearch(null);

    const newPos = lastAt + mention.length + 1;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (mentionSearch !== null && mentionResults.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setMentionIndex((i) => (i + 1) % mentionResults.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setMentionIndex(
          (i) => (i - 1 + mentionResults.length) % mentionResults.length,
        );
      } else if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        insertMention(mentionResults[mentionIndex]);
      } else if (e.key === "Escape") {
        setMentionSearch(null);
      }
    }
  };

  const handleTextareaChange = (val: string) => {
    onChange(val);
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const pos = textarea.selectionStart;
    const text = val.slice(0, pos);
    const lastAt = text.lastIndexOf("@");

    if (lastAt !== -1 && !text.slice(lastAt).includes(" ")) {
      setMentionSearch(text.slice(lastAt + 1));

      const rect = textarea.getBoundingClientRect();
      setMentionCoords({
        top: rect.top + 20,
        left: rect.left + 20,
      });
    } else {
      setMentionSearch(null);
    }
  };

  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const startEditing = useCallback(() => {
    setIsEditing(true);
    setShowPreview(false);
    setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  function handleTextareaBlur() {
    setTimeout(() => {
      if (isFullscreen) return;
      setIsEditing(false);
      onBlur(value);
      setMentionSearch(null);
    }, 150);
  }

  function toggleFullscreen() {
    setIsFullscreen(!isFullscreen);
    if (!isFullscreen) {
      setIsEditing(true);
      setShowPreview(false);
    }
  }

  const renderMentionList = () => {
    if (mentionSearch === null || mentionResults.length === 0) return null;
    return createPortal(
      <div
        className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden w-72 max-h-60 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200"
        style={{ left: mentionCoords.left, top: mentionCoords.top }}
      >
        <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center justify-between">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Mention Task
          </span>
        </div>
        <div className="overflow-y-auto py-1">
          {mentionResults.map((t, i) => (
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
                    #{t.id.slice(0, 6)}
                  </span>
                  {t.projectName && (
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
        <div className="fixed inset-0 z-[99999] flex flex-col bg-white">
          <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
            <span className="text-sm font-semibold text-gray-700 font-mono">
              DESCRIPTION_FULLSCREEN_MODE
            </span>
            <button
              onClick={() => setIsFullscreen(false)}
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
            extra={
              <button
                onClick={() => setIsFullscreen(false)}
                className="ml-2 px-4 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 shadow-sm transition-all active:scale-95 font-medium"
              >
                Exit Fullscreen
              </button>
            }
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
          <div
            onClick={startEditing}
            className="min-h-[60px] cursor-text rounded border border-transparent hover:border-gray-200 px-2 py-1.5"
          >
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
      className={`relative flex flex-col transition-all overflow-hidden ${isEditing ? "bg-white border border-gray-200 rounded-lg shadow-sm" : "min-h-[2.5rem]"}`}
    >
      <DescriptionEditorContext.Provider value={{ onOpenTask }}>
        <Toolbar
          textareaRef={textareaRef}
          onChange={onChange}
          showPreview={showPreview}
          onTogglePreview={() => setShowPreview(!showPreview)}
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
        <div className="flex items-center justify-between px-3 py-1.5 border-t border-gray-100 bg-gray-50/50">
          <span className="text-[10px] text-gray-400 font-mono">
            Markdown supported • Use @ to mention tasks
          </span>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="text-[11px] font-medium text-gray-500 hover:text-gray-900 transition-colors"
          >
            Done
          </button>
        </div>
      </DescriptionEditorContext.Provider>
    </div>
  );
}
