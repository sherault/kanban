"use client";

import {
  useState,
  useTransition,
  useEffect,
  useRef,
  useCallback,
  useId,
} from "react";
import Link from "next/link";
import type {
  TaskDto,
  MembershipDto,
  TaskHistoryDto,
  Column,
} from "@kanban/shared";
import { ColorPicker } from "./ColorPicker";
import { DescriptionEditor } from "./DescriptionEditor";
import {
  updateTaskAction,
  deleteTaskAction,
  addTagAction,
  removeTagAction,
  addWatcherAction,
  removeWatcherAction,
  addAdvisorAction,
  removeAdvisorAction,
  getTaskHistoryAction,
  addLinkAction,
  removeLinkAction,
  getTaskByIdAction,
} from "@/actions/tasks";

interface Props {
  task: TaskDto | { taskId: string; id?: string };
  orgMembers: MembershipDto[];
  projectId: string;
  orgId: string;
  currentOpenTaskIds: string[];
  revision: number;
  objectives: string[];
  allTags: string[];
  onClose: () => void;
  onUpdated: (task: TaskDto) => void;
  onDeleted: (taskId: string) => void;
  onCloseAll?: () => void;
  onOpenRelatedTask?: (taskId: string) => void;
  showCloseAll?: boolean;
  isActive: boolean;
  /** Whether this panel is currently expanded (not just a title strip) */
  isExpanded: boolean;
  onActivate: () => void;
  /** Fold this panel back to a title strip (only shown when isExpanded and a second panel is also open) */
  onFold?: () => void;
  /** Open this task as the comparison (left) panel */
  onOpenAsComparison?: () => void;
  width: number;
  onWidthChange: (w: number) => void;
}

const COLUMN_BADGE: Record<Column, string> = {
  ideas: "bg-purple-100 text-purple-700",
  todo: "bg-gray-100 text-gray-700",
  doing: "bg-blue-100 text-blue-700",
  done: "bg-green-100 text-green-700",
};

// ── Conflict-aware field hook ─────────────────────────────────────────────────

interface ConflictInfo {
  ours: string;
  theirs: string;
}

function useConflictField(externalValue: string) {
  const [value, setValue] = useState(externalValue);
  const [isFocused, setIsFocused] = useState(false);
  const [conflict, setConflict] = useState<ConflictInfo | null>(null);
  const valueAtFocusRef = useRef(externalValue);
  const pendingWsRef = useRef<string | null>(null);

  const [prevExternalValue, setPrevExternalValue] = useState(externalValue);

  if (externalValue !== prevExternalValue) {
    setPrevExternalValue(externalValue);
    if (!isFocused) {
      setValue(externalValue || "");
    }
  }

  useEffect(() => {
    if (isFocused) {
      pendingWsRef.current = externalValue;
    }
  }, [externalValue, isFocused]);

  const onFocus = useCallback(() => {
    setIsFocused(true);
    valueAtFocusRef.current = value;
    pendingWsRef.current = null;
  }, [value]);

  const onBlur = useCallback(() => {
    setIsFocused(false);
    const pendingWs = pendingWsRef.current;
    if (pendingWs !== null && pendingWs !== valueAtFocusRef.current) {
      // WS changed the value while we had focus
      if (value !== valueAtFocusRef.current) {
        // We also changed it → real conflict
        setConflict({ ours: value, theirs: pendingWs });
      } else {
        // We didn't change → silently accept WS
        setValue(pendingWs);
      }
    }
    pendingWsRef.current = null;
  }, [value]);

  const resolveConflict = useCallback(
    (choice: "ours" | "theirs") => {
      if (conflict && choice === "theirs") setValue(conflict.theirs);
      setConflict(null);
    },
    [conflict],
  );

  return { value, setValue, onFocus, onBlur, conflict, resolveConflict };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConflictModal({
  field,
  conflict,
  onResolve,
}: {
  field: string;
  conflict: ConflictInfo;
  onResolve: (choice: "ours" | "theirs") => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-96 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">
          Conflict on <span className="italic">{field}</span>
        </h3>
        <p className="text-xs text-gray-500">
          This field was updated by someone else while you were editing it.
        </p>
        <div className="space-y-2">
          <div className="rounded border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-400 mb-1">
              Your version
            </p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {conflict.ours || <em className="text-gray-400">empty</em>}
            </p>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-600 mb-1">
              Their version
            </p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">
              {conflict.theirs || <em className="text-gray-400">empty</em>}
            </p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onResolve("ours")}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:border-gray-300 text-gray-700"
          >
            Keep mine
          </button>
          <button
            onClick={() => onResolve("theirs")}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Accept theirs
          </button>
        </div>
      </div>
    </div>
  );
}

function TagInput({
  tags,
  allTags,
  onAdd,
  onRemove,
}: {
  tags: string[];
  allTags: string[];
  onAdd: (t: string) => void;
  onRemove: (t: string) => void;
}) {
  const [input, setInput] = useState("");
  const listId = useId();
  const suggestions = allTags.filter((t) => !(tags || []).includes(t));

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      onAdd(input.trim().toLowerCase());
      setInput("");
    }
  }

  return (
    <div className="flex flex-wrap gap-1 border border-gray-200 rounded px-2 py-1.5 min-h-[36px] focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400">
      {(tags || []).map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded"
        >
          {tag}
          <button
            onClick={() => onRemove(tag)}
            className="text-gray-400 hover:text-gray-600 leading-none"
          >
            &times;
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder={(tags?.length || 0) === 0 ? "Add tag, press Enter…" : ""}
        className="flex-1 min-w-[80px] text-xs outline-none bg-transparent"
      />
      <datalist id={listId}>
        {suggestions.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>
    </div>
  );
}

function UserChips({
  users,
  orgMembers,
  onAdd,
  onRemove,
}: {
  users: Array<{ id: string; displayName: string }>;
  orgMembers: MembershipDto[];
  onAdd: (userId: string) => void;
  onRemove: (userId: string) => void;
}) {
  const assigned = new Set((users || []).map((u) => u.id));
  const available = (orgMembers || []).filter((m) => !assigned.has(m.userId));

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {(users || []).map((u) => (
          <span
            key={u.id}
            className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded"
          >
            {u.displayName}
            <button
              onClick={() => onRemove(u.id)}
              className="text-blue-400 hover:text-blue-700 leading-none"
            >
              &times;
            </button>
          </span>
        ))}
      </div>
      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) {
              onAdd(e.target.value);
              e.target.value = "";
            }
          }}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-400"
        >
          <option value="">+ Add…</option>
          {available.map((m) => (
            <option key={m.userId} value={m.userId}>
              {m.user.displayName}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

function HistoryFeed({ history }: { history: TaskHistoryDto[] }) {
  if (!history || history.length === 0)
    return <p className="text-xs text-gray-400">No history yet.</p>;

  return (
    <ul className="space-y-2">
      {history.map((entry) => (
        <li key={entry.id} className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">
            {entry.actor?.displayName || "System"}
          </span>
          {" changed "}
          <span className="font-medium">{entry.field}</span>
          {entry.oldValue !== null && (
            <>
              {" "}
              from{" "}
              <span className="line-through text-gray-400">
                {entry.oldValue}
              </span>
            </>
          )}
          {entry.newValue !== null && (
            <>
              {" "}
              to <span className="text-gray-700">{entry.newValue}</span>
            </>
          )}
          <span className="ml-1 text-gray-400">
            ·{" "}
            {new Date(entry.changedAt).toLocaleDateString("en", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function TaskDetailSidebar({
  task: initialTask,
  orgMembers,
  projectId,
  orgId,
  currentOpenTaskIds,
  revision,
  objectives,
  allTags,
  onClose,
  onUpdated,
  onDeleted,
  onCloseAll,
  onOpenRelatedTask,
  showCloseAll,
  isActive,
  isExpanded,
  onActivate,
  onFold,
  onOpenAsComparison,
  width: sidebarWidth,
  onWidthChange: setSidebarWidth,
}: Props) {
  const [task, setTask] = useState<TaskDto | null>(initialTask as TaskDto);
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<TaskHistoryDto[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [linkedTasks, setLinkedTasks] = useState<TaskDto[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const taskId =
    (initialTask as TaskDto).id || (initialTask as { taskId: string }).taskId;

  // Handle cross-project or archived tasks that might be shells
  const [prevInitialTask, setPrevInitialTask] = useState(initialTask);
  const [prevTaskId, setPrevTaskId] = useState(taskId);

  if (taskId !== prevTaskId) {
    setPrevTaskId(taskId);
    setTask(null);
  }

  const initialId =
    initialTask.id || (initialTask as { taskId?: string }).taskId;
  const isShell =
    !initialTask.id && !!(initialTask as { taskId?: string }).taskId;

  if (initialTask !== prevInitialTask) {
    setPrevInitialTask(initialTask);
    if (!isShell) {
      setTask(initialTask as TaskDto);
    }
  }

  useEffect(() => {
    if (isShell && initialId && (!task || task.id !== initialId)) {
      void Promise.resolve().then(() => setLoading(true));
      void getTaskByIdAction(initialId).then((res) => {
        if (res.task) setTask(res.task);
        setLoading(false);
      });
    }
  }, [isShell, initialId, task]);

  const taskIdForLinks = task?.id;
  const linkedTaskIds = task?.linkedTaskIds;
  const linkedIdsString = (linkedTaskIds || []).join(",");

  // Adjust state during render pattern for linked tasks initialization
  if (!taskIdForLinks || (linkedTaskIds || []).length === 0) {
    if (linkedTasks.length > 0) setLinkedTasks([]);
  }

  useEffect(() => {
    if (!taskIdForLinks || !linkedTaskIds) return;
    const ids = linkedTaskIds || [];
    if (taskIdForLinks && ids.length > 0) {
      void Promise.resolve().then(() => setLoadingLinks(true));
      void Promise.all(ids.map((id) => getTaskByIdAction(id))).then(
        (results) => {
          setLinkedTasks(
            results.map((r) => r.task).filter((t): t is TaskDto => !!t),
          );
          setLoadingLinks(false);
        },
      );
    }
  }, [taskIdForLinks, linkedIdsString, linkedTaskIds]);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = sidebarWidth;
      function onMove(ev: MouseEvent) {
        const delta = startX - ev.clientX;
        setSidebarWidth(Math.min(1200, Math.max(384, startW + delta)));
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [sidebarWidth, setSidebarWidth],
  );

  // Controlled conflict-aware fields
  const titleField = useConflictField(task?.title || "");
  const descField = useConflictField(task?.description ?? "");
  const objField = useConflictField(task?.objective ?? "");
  const subjectField = useConflictField(task?.globalSubject ?? "");

  // Keep fields in sync when task prop changes (WS updates)
  const prevTaskRef = useRef(task);
  useEffect(() => {
    if (!task || !prevTaskRef.current) {
      prevTaskRef.current = task;
      return;
    }
    const prev = prevTaskRef.current;
    prevTaskRef.current = task;
    if (task.title !== prev.title) titleField.setValue(task.title || "");
    if (task.description !== prev.description)
      descField.setValue(task.description ?? "");
    if (task.objective !== prev.objective)
      objField.setValue(task.objective ?? "");
    if (task.globalSubject !== prev.globalSubject)
      subjectField.setValue(task.globalSubject ?? "");
  }, [task, titleField, descField, objField, subjectField]);

  function save(body: Parameters<typeof updateTaskAction>[2]) {
    if (!task) return;
    setSaveError(null);
    startTransition(async () => {
      const result = await updateTaskAction(projectId, task.id, body);
      if (result.error) setSaveError(result.error);
      else if (result.task) onUpdated(result.task);
    });
  }

  function handleDelete() {
    if (!task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteTaskAction(projectId, task.id);
      if (result.error) setSaveError(result.error);
      else onDeleted(task.id);
    });
  }

  function handleTagAdd(tag: string) {
    if (!task) return;
    startTransition(async () => {
      const result = await addTagAction(projectId, task.id, tag);
      if (result.task) onUpdated(result.task);
    });
  }

  function handleTagRemove(tag: string) {
    if (!task) return;
    startTransition(async () => {
      const result = await removeTagAction(projectId, task.id, tag);
      if (result.task) onUpdated(result.task);
    });
  }

  function handleWatcherAdd(userId: string) {
    if (!task) return;
    startTransition(async () => {
      const result = await addWatcherAction(projectId, task.id, userId);
      if (result.task) onUpdated(result.task);
    });
  }

  function handleWatcherRemove(userId: string) {
    if (!task) return;
    startTransition(async () => {
      const result = await removeWatcherAction(projectId, task.id, userId);
      if (result.task) onUpdated(result.task);
    });
  }

  function handleAdvisorAdd(userId: string) {
    if (!task) return;
    startTransition(async () => {
      const result = await addAdvisorAction(projectId, task.id, userId);
      if (result.task) onUpdated(result.task);
    });
  }

  function handleAdvisorRemove(userId: string) {
    if (!task) return;
    startTransition(async () => {
      const result = await removeAdvisorAction(projectId, task.id, userId);
      if (result.task) onUpdated(result.task);
    });
  }

  const taskIdForHistory = task?.id;
  useEffect(() => {
    if (!showHistory || !taskIdForHistory) return;
    void getTaskHistoryAction(projectId, taskIdForHistory).then((res) => {
      if (res.history) setHistory(res.history);
    });
  }, [showHistory, revision, projectId, taskIdForHistory]);

  // First active conflict to show in modal
  const activeConflict = titleField.conflict
    ? {
        field: "Title",
        info: titleField.conflict,
        resolve: titleField.resolveConflict,
      }
    : descField.conflict
      ? {
          field: "Description",
          info: descField.conflict,
          resolve: descField.resolveConflict,
        }
      : objField.conflict
        ? {
            field: "Objective",
            info: objField.conflict,
            resolve: objField.resolveConflict,
          }
        : subjectField.conflict
          ? {
              field: "Global subject",
              info: subjectField.conflict,
              resolve: subjectField.resolveConflict,
            }
          : null;

  return (
    <>
      {activeConflict && (
        <ConflictModal
          field={activeConflict.field}
          conflict={activeConflict.info}
          onResolve={activeConflict.resolve}
        />
      )}

      {!task ? null : (
        <aside
          data-sidebar="true"
          style={{ width: isExpanded ? sidebarWidth : 48 }}
          className={`border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden shrink-0 relative transition-opacity duration-300 ${!isActive ? "opacity-95" : "opacity-100"}`}
        >
          {/* Title strip overlay — only for folded (non-expanded) panels */}
          {!isExpanded && (
            <div
              onClick={onActivate}
              className="group absolute inset-0 z-[100] bg-gray-900/5 cursor-pointer hover:bg-gray-900/10 transition-colors flex items-start"
            >
              <div
                className="w-12 h-full flex items-center justify-center bg-white border-r border-gray-200"
                style={{
                  writingMode: "vertical-rl",
                  transform: "rotate(180deg)",
                }}
              >
                <span className="text-sm font-bold text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis max-h-[80%] uppercase tracking-widest px-2">
                  {task.title || "Untitled Task"}
                </span>
              </div>
              {/* Compare icon — visible on hover of a folded strip */}
              {onOpenAsComparison && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpenAsComparison();
                  }}
                  className="absolute top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
                  title="Open as comparison panel"
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 14 14"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="1"
                      y="1"
                      width="5"
                      height="12"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <rect
                      x="8"
                      y="1"
                      width="5"
                      height="12"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                  </svg>
                </button>
              )}
            </div>
          )}
          {/* Resize handle — only for expanded panels */}
          {isExpanded && (
            <div
              onMouseDown={onResizeMouseDown}
              className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 transition-colors z-10 group"
              title="Drag to resize"
            >
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors" />
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
            <div className="flex items-center gap-2">
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${COLUMN_BADGE[task.column] ?? "bg-gray-100 text-gray-700"}`}
              >
                {task.column || "..."}
              </span>
              {showCloseAll && onCloseAll && (
                <button
                  onClick={onCloseAll}
                  className="text-[10px] font-bold tracking-wider uppercase text-red-500 hover:text-red-700 transition-colors"
                  title="Close all open panels"
                >
                  Close All
                </button>
              )}
            </div>
            <div className="flex items-center gap-3">
              {isPending && (
                <span className="text-xs text-gray-400">Saving…</span>
              )}
              {/* Fold button — only on the LEFT (pinned) panel when comparison is active */}
              {onFold && (
                <button
                  onClick={onFold}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                  title="Close comparison view"
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <rect
                      x="1"
                      y="2"
                      width="5"
                      height="12"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.4"
                    />
                    <rect
                      x="10"
                      y="2"
                      width="5"
                      height="12"
                      rx="1"
                      stroke="currentColor"
                      strokeWidth="1.4"
                      strokeDasharray="2 1.5"
                    />
                  </svg>
                </button>
              )}
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {saveError && (
              <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs">
                {saveError}
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-3">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm font-medium">Fetching task details...</p>
              </div>
            ) : (
              <div className="flex-1 p-5 space-y-5 overflow-y-auto">
                {/* Project Context */}
                <div className="mb-[-12px]">
                  <Link
                    href={`/orgs/${orgId}/projects/${task.projectId}?tasks=${(currentOpenTaskIds || []).join(",")}`}
                    className={`text-[10px] uppercase font-bold tracking-widest flex items-center gap-1 transition-colors ${
                      task.projectId !== projectId
                        ? "text-amber-600 hover:text-amber-700"
                        : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <span className="opacity-70">Project:</span>
                    <span className="truncate">
                      {task.projectName || task.projectId}
                    </span>
                    {task.projectId !== projectId && (
                      <span className="ml-1 text-[8px] bg-amber-100 text-amber-700 px-1 rounded">
                        External
                      </span>
                    )}
                  </Link>
                </div>

                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Title
                  </label>
                  <input
                    value={titleField.value}
                    onChange={(e) => titleField.setValue(e.target.value)}
                    onFocus={titleField.onFocus}
                    onBlur={(e) => {
                      titleField.onBlur();
                      const v = e.target.value.trim();
                      if (v && v !== task.title) save({ title: v });
                    }}
                    className="w-full text-sm font-medium text-gray-900 border border-transparent rounded px-2 py-1.5 hover:border-gray-200 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                  />
                </div>

                {/* Background color */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Color
                  </label>
                  <ColorPicker
                    value={task.backgroundColor ?? null}
                    onChange={(color) => {
                      if (color !== task.backgroundColor)
                        save({ backgroundColor: color });
                    }}
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Description
                  </label>
                  <DescriptionEditor
                    key={task.id}
                    value={descField.value}
                    onChange={descField.setValue}
                    onFocus={descField.onFocus}
                    onBlur={(v) => {
                      descField.onBlur();
                      const val = v || null;
                      if (val !== task.description) save({ description: val });
                    }}
                    onOpenTask={onOpenRelatedTask}
                  />
                </div>

                {/* Linked Tasks */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                    Linked Tasks
                  </label>
                  <div className="space-y-1.5">
                    {(task.linkedTaskIds || []).map((linkId) => {
                      const linkedTask = linkedTasks.find(
                        (lt) => lt.id === linkId,
                      );
                      const isNotFound = !loadingLinks && !linkedTask;

                      return (
                        <div
                          key={linkId}
                          className="group flex items-center justify-between p-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isNotFound ? (
                              <div
                                className="flex items-center gap-1.5 text-red-500"
                                title="Task does not exist anymore"
                              >
                                <span className="text-xs">❌</span>
                                <span className="text-xs font-mono truncate max-w-[120px]">
                                  {linkId}
                                </span>
                              </div>
                            ) : (
                              <button
                                onClick={() => onOpenRelatedTask?.(linkId)}
                                className="text-xs text-gray-700 hover:text-blue-600 truncate text-left"
                              >
                                <span className="font-medium">
                                  {linkedTask?.title}
                                </span>
                                {linkedTask?.projectId !== projectId && (
                                  <span className="ml-1.5 px-1 bg-gray-100 text-[9px] text-gray-500 rounded font-normal uppercase">
                                    {linkedTask?.projectName}
                                  </span>
                                )}
                              </button>
                            )}
                          </div>
                          <button
                            onClick={async () => {
                              const res = await removeLinkAction(
                                projectId,
                                task.id,
                                linkId,
                              );
                              if (res.task) onUpdated(res.task);
                            }}
                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs transition-all"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}

                    <div className="pt-1">
                      <input
                        type="text"
                        placeholder="Paste task ID to link..."
                        className="w-full text-[11px] border border-gray-100 rounded px-2 py-1 focus:outline-none focus:border-blue-300 transition-all bg-gray-50/50"
                        onKeyDown={async (e) => {
                          if (e.key === "Enter") {
                            const targetId = e.currentTarget.value.trim();
                            if (targetId && targetId !== task.id) {
                              const res = await addLinkAction(
                                projectId,
                                task.id,
                                targetId,
                              );
                              if (res.task) onUpdated(res.task);
                              e.currentTarget.value = "";
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                </div>

                {/* Objective */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Objective
                  </label>
                  <input
                    list={`obj-list-${task.id}`}
                    value={objField.value}
                    onChange={(e) => objField.setValue(e.target.value)}
                    onFocus={objField.onFocus}
                    onBlur={(e) => {
                      objField.onBlur();
                      const v = e.target.value || null;
                      if (v !== task.objective) save({ objective: v });
                    }}
                    placeholder="Add an objective…"
                    className="w-full text-sm text-gray-700 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                  <datalist id={`obj-list-${task.id}`}>
                    {(objectives || [])
                      .filter((o) => o !== task.objective)
                      .map((o) => (
                        <option key={o} value={o} />
                      ))}
                  </datalist>
                </div>

                {/* Global subject */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Global subject
                  </label>
                  <input
                    value={subjectField.value}
                    onChange={(e) => subjectField.setValue(e.target.value)}
                    onFocus={subjectField.onFocus}
                    onBlur={(e) => {
                      subjectField.onBlur();
                      const v = e.target.value || null;
                      if (v !== task.globalSubject) save({ globalSubject: v });
                    }}
                    placeholder="Epic or global subject…"
                    className="w-full text-sm text-gray-700 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                  />
                </div>

                {/* Tags */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Tags
                  </label>
                  <TagInput
                    tags={task.tags}
                    allTags={allTags}
                    onAdd={handleTagAdd}
                    onRemove={handleTagRemove}
                  />
                </div>

                {/* Dates */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      Start
                    </label>
                    <input
                      key={task.id + "-start-" + task.startDate}
                      type="date"
                      defaultValue={task.startDate}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== task.startDate)
                          save({ startDate: e.target.value });
                      }}
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                      End
                    </label>
                    <input
                      key={task.id + "-end-" + task.endDate}
                      type="date"
                      defaultValue={task.endDate}
                      onBlur={(e) => {
                        if (e.target.value && e.target.value !== task.endDate)
                          save({ endDate: e.target.value });
                      }}
                      className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                {/* People */}
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Doer
                  </label>
                  <select
                    key={task.id + "-doer-" + task.doer?.id}
                    defaultValue={task.doer?.id ?? ""}
                    onChange={(e) => save({ doerId: e.target.value || null })}
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400"
                  >
                    <option value="">— Unassigned —</option>
                    {(orgMembers || []).map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user?.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Validator
                  </label>
                  <select
                    key={task.id + "-validator-" + task.validator?.id}
                    defaultValue={task.validator?.id ?? ""}
                    onChange={(e) =>
                      save({ validatorId: e.target.value || null })
                    }
                    className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400"
                  >
                    <option value="">— Unassigned —</option>
                    {(orgMembers || []).map((m) => (
                      <option key={m.userId} value={m.userId}>
                        {m.user?.displayName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Watchers
                  </label>
                  <UserChips
                    users={task.watchers}
                    orgMembers={orgMembers}
                    onAdd={handleWatcherAdd}
                    onRemove={handleWatcherRemove}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Advisors
                  </label>
                  <UserChips
                    users={task.advisors}
                    orgMembers={orgMembers}
                    onAdd={handleAdvisorAdd}
                    onRemove={handleAdvisorRemove}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                    Reporter
                  </label>
                  <p className="text-sm text-gray-700 px-2 py-1.5 font-medium">
                    {task.reporter?.displayName || "System / Robot"}
                  </p>
                </div>

                {/* History */}
                <div className="border-t border-gray-100 pt-5">
                  <button
                    onClick={() => setShowHistory((v) => !v)}
                    className="text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 flex items-center gap-1"
                  >
                    <span>{showHistory ? "▾" : "▸"}</span> History
                  </button>
                  {showHistory && (
                    <div className="mt-3">
                      {history === null ? (
                        <p className="text-xs text-gray-400">
                          Loading history…
                        </p>
                      ) : (
                        <HistoryFeed history={history} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-5 py-4 border-t border-gray-200 shrink-0">
            {confirmDelete ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-red-600 flex-1">
                  Delete this task?
                </span>
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isPending}
                  className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Confirm
                </button>
              </div>
            ) : (
              <button
                onClick={handleDelete}
                className="text-xs text-red-500 hover:text-red-700 transition-colors"
              >
                Delete task
              </button>
            )}
          </div>
        </aside>
      )}
    </>
  );
}
