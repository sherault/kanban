"use client";

import { useState, useTransition, useRef, useEffect, useMemo } from "react";
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { TaskDto, MembershipDto } from "@kanban/shared";
import { Column } from "@kanban/shared";
import { moveTaskAction, archiveTasksAction } from "@/actions/tasks";
import { useProjectSocket } from "@/hooks/useProjectSocket";
import { TaskCard } from "./TaskCard";
import { BoardColumn } from "./BoardColumn";
import { NewTaskModal } from "./NewTaskModal";
import { TaskDetailSidebar } from "./TaskDetailSidebar";
import { CsvImportModal } from "./CsvImportModal";
import { ArchivePanel } from "./ArchivePanel";

const COLUMNS: { id: Column; label: string }[] = [
  { id: Column.IDEAS, label: "Ideas" },
  { id: Column.TODO, label: "To Do" },
  { id: Column.DOING, label: "Doing" },
  { id: Column.DONE, label: "Done" },
];

interface Props {
  initialTasks: TaskDto[];
  orgMembers: MembershipDto[];
  projectId: string;
  orgId: string;
  currentUserId: string;
  maxOpenPanels: number;
}

export function BoardClient({
  initialTasks,
  orgMembers,
  projectId,
  orgId,
  currentUserId,
  maxOpenPanels,
}: Props) {
  const [tasks, setTasks] = useState<TaskDto[]>(initialTasks);
  const [activeTask, setActiveTask] = useState<TaskDto | null>(null);
  const [openTasks, setOpenTasks] = useState<
    Array<{ id: string; archived?: boolean; data?: TaskDto }>
  >([]);
  // IDs of panels currently expanded side-by-side (max 2, ordered left→right)
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [isMounted, setIsMounted] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    const saved = localStorage.getItem("kanban_open_tasks");
    if (saved) {
      try {
        setOpenTasks(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse open tasks", e);
      }
    }
    const savedExpanded = localStorage.getItem("kanban_expanded_panels");
    if (savedExpanded) {
      try {
        setExpandedIds(JSON.parse(savedExpanded));
      } catch (e) {
        console.error("Failed to parse expanded panels", e);
      }
    }
    setIsHydrated(true);
  }, []);

  // Sync tasks when navigating between projects (React component reuse)
  useEffect(() => {
    setTasks(initialTasks);
  }, [initialTasks]);

  const [panelWidths, setPanelWidths] = useState<Record<string, number>>({});
  const [archiveRevision, setArchiveRevision] = useState(0);
  const [newTaskColumn, setNewTaskColumn] = useState<Column | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [ideasCollapsed, setIdeasCollapsed] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sidebarRevision, setSidebarRevision] = useState(0);
  const [selectedDoneIds, setSelectedDoneIds] = useState<Set<string>>(
    new Set(),
  );
  const [archiving, setArchiving] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeObjective, setActiveObjective] = useState<string | null>(null);
  const [activeDoerId, setActiveDoerId] = useState<string | null>(null);
  const objectives = useMemo(
    () => [
      ...new Set(tasks.flatMap((t) => (t.objective ? [t.objective] : []))),
    ],
    [tasks],
  );
  const allTags = useMemo(
    () => [...new Set(tasks.flatMap((t) => t.tags))],
    [tasks],
  );
  const activeDoerName = activeDoerId
    ? (tasks.find((t) => t.doer?.id === activeDoerId)?.doer?.displayName ??
      activeDoerId)
    : null;
  const [, startTransition] = useTransition();

  // Stable ref to openTasks for WS callbacks
  const openTasksRef = useRef<Array<{ id: string; archived?: boolean }>>([]);
  useEffect(() => {
    openTasksRef.current = openTasks;
  }, [openTasks]);

  // Persist open tasks and expanded panels to localStorage
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem("kanban_open_tasks", JSON.stringify(openTasks));
    }
  }, [openTasks, isHydrated]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(
        "kanban_expanded_panels",
        JSON.stringify(expandedIds),
      );
    }
  }, [expandedIds, isHydrated]);

  // Stable shell map to prevent redundant sidebar fetches for external tasks
  const stableShells = useMemo(() => {
    const map = new Map<string, { taskId: string }>();
    openTasks.forEach((ot) => {
      map.set(ot.id, { taskId: ot.id });
    });
    return map;
  }, [openTasks]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  // ── WebSocket real-time ───────────────────────────────────────────────────

  const { isConnected } = useProjectSocket(projectId, {
    onTaskCreated(task) {
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === task.id);
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = task;
          return next;
        }
        return [...prev, task];
      });
      setArchiveRevision((v) => v + 1);
    },
    onTaskUpdated(task) {
      // Always update state — the sidebar uses uncontrolled inputs (defaultValue)
      // so in-progress text edits are preserved automatically.
      setTasks((prev) => prev.map((t) => (t.id !== task.id ? t : task)));

      // If the updated task is open in the sidebar, bump the revision to
      // remount it with fresh values — but only when no sidebar field has focus
      // (i.e. the user isn't actively typing).
      const isOpen = openTasksRef.current.some((t) => t.id === task.id);
      if (isOpen) {
        const focused = document.activeElement;
        const sidebarHasFocus =
          focused?.closest('[data-sidebar="true"]') ?? false;
        if (!sidebarHasFocus) {
          setSidebarRevision((v) => v + 1);
        }
      }

      // Sync data to openTasks for localStorage persistence
      setOpenTasks((prev) =>
        prev.map((ot) => (ot.id === task.id ? { ...ot, data: task } : ot)),
      );

      setArchiveRevision((v) => v + 1);
    },
    onTaskDeleted(taskId) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setSelectedDoneIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setOpenTasks((prev) => prev.filter((t) => t.id !== taskId));
      setExpandedIds((prev) => prev.filter((id) => id !== taskId));
      setArchiveRevision((v) => v + 1);
    },
  });

  // ── Drag and drop ─────────────────────────────────────────────────────────

  const handleOpenTask = (taskId: string, archived?: boolean) => {
    // Always track in openTasks (for strips / persistence)
    setOpenTasks((prev) => {
      const existing = prev.find((t) => t.id === taskId);
      if (existing) {
        return [...prev.filter((t) => t.id !== taskId), existing];
      }
      const next = [...prev, { id: taskId, archived }];
      if (next.length > maxOpenPanels) {
        return next.slice(next.length - maxOpenPanels);
      }
      return next;
    });

    // Expand:
    // • Single mode (0–1 expanded): replace the single slot
    // • Comparison mode (2 expanded): replace the RIGHT slot only, keep LEFT pinned
    setExpandedIds((prev) => {
      if (prev.includes(taskId)) return prev; // already shown, no change
      if (prev.length >= 2) return [prev[0], taskId]; // comparison: replace right
      return [taskId]; // single: replace
    });
  };

  // Open a task explicitly as the LEFT comparison panel.
  // Current right panel (if any) stays as the right.
  const handleOpenAsComparison = (taskId: string, archived?: boolean) => {
    setOpenTasks((prev) => {
      const existing = prev.find((t) => t.id === taskId);
      if (existing) {
        return [...prev.filter((t) => t.id !== taskId), existing];
      }
      const next = [...prev, { id: taskId, archived }];
      if (next.length > maxOpenPanels) {
        return next.slice(next.length - maxOpenPanels);
      }
      return next;
    });

    setExpandedIds((prev) => {
      // The current right/single panel becomes the right, new task becomes left
      const currentRight = prev.length > 0 ? prev[prev.length - 1] : null;
      if (!currentRight || currentRight === taskId) {
        // Nothing open yet or same task — just open normally as single
        return [taskId];
      }
      // Pin taskId as LEFT, keep currentRight as RIGHT
      return [taskId, currentRight];
    });
  };

  // Clicking a title strip re-opens it via normal single/comparison logic
  const handleActivateTask = (taskId: string) => {
    handleOpenTask(taskId);
  };

  // Fold the left comparison panel back to a strip (end comparison mode)
  const handleFoldPanel = (taskId: string) => {
    setExpandedIds((prev) => prev.filter((id) => id !== taskId));
  };

  const handleCloseTask = (taskId: string) => {
    setOpenTasks((prev) => prev.filter((t) => t.id !== taskId));
    setExpandedIds((prev) => prev.filter((id) => id !== taskId));
  };

  const handleCloseAllTasks = () => {
    setOpenTasks([]);
    setExpandedIds([]);
  };

  // Total width consumed by all panels (for board padding)
  const sidebarTotalWidth = useMemo(() => {
    if (openTasks.length === 0) return 0;
    const foldedCount = openTasks.filter(
      (ot) => !expandedIds.includes(ot.id),
    ).length;
    const expandedWidth = expandedIds.reduce(
      (sum, id) => sum + (panelWidths[id] || 384),
      0,
    );
    return expandedWidth + foldedCount * 48;
  }, [openTasks, expandedIds, panelWidths]);

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null);
    setError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const taskId = active.id as string;
    const newColumn = over.id as Column;
    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.column === newColumn) return;

    // When moving to "doing" with no doer, the API auto-assigns the current
    // user — optimistically reflect that in local state.
    const optimisticDoer =
      newColumn === Column.DOING && !task.doer
        ? orgMembers.find((m) => m.userId === currentUserId)
        : null;

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              column: newColumn,
              ...(optimisticDoer
                ? {
                    doer: {
                      id: optimisticDoer.userId,
                      displayName: optimisticDoer.user.displayName,
                    },
                  }
                : {}),
            }
          : t,
      ),
    );

    startTransition(async () => {
      const result = await moveTaskAction(projectId, taskId, newColumn);
      if (result.error) {
        // Revert to original state
        setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)));
        setError(result.error);
      } else if (result.task) {
        setTasks((prev) =>
          prev.map((t) => (t.id === result.task!.id ? result.task! : t)),
        );
      }
    });
  }

  // ── Archive ───────────────────────────────────────────────────────────────

  async function handleArchiveSelected() {
    if (selectedDoneIds.size === 0) return;
    setArchiving(true);
    const ids = Array.from(selectedDoneIds);
    const result = await archiveTasksAction(projectId, ids);
    setArchiving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setTasks((prev) => prev.filter((t) => !ids.includes(t.id)));
      setSelectedDoneIds(new Set());
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      <DndContext
        id="board-dnd"
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          {/* Error banner */}
          {error && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2 flex items-center justify-between shrink-0">
              <span>{error}</span>
              <button
                onClick={() => setError(null)}
                className="ml-2 text-red-400 hover:text-red-600 text-lg leading-none"
              >
                ×
              </button>
            </div>
          )}

          {/* Active filter chips */}
          {(activeTag || activeObjective || activeDoerId) && (
            <div className="mx-6 mt-4 flex items-center gap-2 shrink-0 flex-wrap">
              <span className="text-xs text-gray-400">Filters:</span>
              {activeTag && (
                <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 font-medium px-2 py-0.5 rounded-full">
                  #{activeTag}
                  <button
                    onClick={() => setActiveTag(null)}
                    className="text-blue-500 hover:text-blue-800 leading-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
              {activeObjective && (
                <span className="inline-flex items-center gap-1 text-xs bg-purple-100 text-purple-700 font-medium px-2 py-0.5 rounded-full">
                  {activeObjective}
                  <button
                    onClick={() => setActiveObjective(null)}
                    className="text-purple-500 hover:text-purple-800 leading-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
              {activeDoerName && (
                <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 font-medium px-2 py-0.5 rounded-full">
                  {activeDoerName}
                  <button
                    onClick={() => setActiveDoerId(null)}
                    className="text-green-500 hover:text-green-800 leading-none ml-0.5"
                  >
                    ×
                  </button>
                </span>
              )}
              {[activeTag, activeObjective, activeDoerId].filter(Boolean)
                .length > 1 && (
                <button
                  onClick={() => {
                    setActiveTag(null);
                    setActiveObjective(null);
                    setActiveDoerId(null);
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 ml-1"
                >
                  Clear all
                </button>
              )}
            </div>
          )}

          {/* Board columns */}
          <div
            className="flex gap-4 p-6 overflow-x-auto flex-1 items-start transition-all duration-300"
            style={{ paddingRight: `${sidebarTotalWidth + 24}px` }}
          >
            {COLUMNS.map(({ id, label }) => {
              const columnTasks = tasks
                .filter(
                  (t) =>
                    t.column === id &&
                    (!activeTag || t.tags.includes(activeTag)) &&
                    (!activeObjective || t.objective === activeObjective) &&
                    (!activeDoerId || t.doer?.id === activeDoerId),
                )
                .sort((a, b) => {
                  if (!a.endDate && !b.endDate) return 0;
                  if (!a.endDate) return 1;
                  if (!b.endDate) return -1;
                  return a.endDate < b.endDate
                    ? -1
                    : a.endDate > b.endDate
                      ? 1
                      : 0;
                });
              return (
                <BoardColumn
                  key={id}
                  column={id}
                  label={label}
                  tasks={columnTasks}
                  collapsed={id === Column.IDEAS ? ideasCollapsed : false}
                  onToggleCollapse={
                    id === Column.IDEAS
                      ? () => setIdeasCollapsed((v) => !v)
                      : undefined
                  }
                  onTaskClick={(taskId) => {
                    handleOpenTask(taskId);
                  }}
                  onOpenAsComparison={(taskId) => {
                    handleOpenAsComparison(taskId);
                  }}
                  onNewTask={() => setNewTaskColumn(id)}
                  onTagClick={(tag) => setActiveTag(tag)}
                  onObjectiveClick={(obj) => setActiveObjective(obj)}
                  onDoerClick={(userId) => setActiveDoerId(userId)}
                  selectable={id === Column.DONE}
                  selectedIds={id === Column.DONE ? selectedDoneIds : undefined}
                  onSelectionChange={
                    id === Column.DONE
                      ? (tid, sel) => {
                          setSelectedDoneIds((prev) => {
                            const next = new Set(prev);
                            if (sel) next.add(tid);
                            else next.delete(tid);
                            return next;
                          });
                        }
                      : undefined
                  }
                />
              );
            })}
          </div>

          {/* Toolbar */}
          <div
            className="px-6 pb-3 flex items-center justify-between shrink-0 transition-all duration-300"
            style={{ paddingRight: `${sidebarTotalWidth + 24}px` }}
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowImport(true)}
                className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 transition-colors"
              >
                Import CSV
              </button>
              {selectedDoneIds.size > 0 && (
                <button
                  onClick={() => void handleArchiveSelected()}
                  disabled={archiving}
                  className="text-xs text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded px-2 py-1 transition-colors"
                >
                  {archiving
                    ? "Archiving..."
                    : `Archive ${selectedDoneIds.size} task${selectedDoneIds.size > 1 ? "s" : ""}`}
                </button>
              )}
            </div>
            {/* Connection status indicator */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-400" : "bg-gray-300"}`}
              />
              <span className="text-xs text-gray-400">
                {isConnected ? "Live" : "Connecting…"}
              </span>
            </div>
          </div>

          {/* Archive panel */}
          <ArchivePanel
            projectId={projectId}
            onRestored={(task) => {
              setTasks((prev) => {
                const idx = prev.findIndex((t) => t.id === task.id);
                if (idx >= 0) {
                  const next = [...prev];
                  next[idx] = task;
                  return next;
                }
                return [...prev, task];
              });
            }}
            onTaskClick={(task) => {
              handleOpenTask(task.id, true);
            }}
            refreshTrigger={archiveRevision}
          />
        </div>

        <DragOverlay>
          {activeTask ? (
            <TaskCard task={activeTask} onClick={() => {}} overlay />
          ) : null}
        </DragOverlay>
      </DndContext>

      {isMounted &&
        openTasks.length > 0 &&
        (() => {
          // Separate panels into expanded (max 2, side by side) and folded (title strips)
          const foldedTasks = openTasks.filter(
            (ot) => !expandedIds.includes(ot.id),
          );
          // expandedIds is ordered left→right; render right-to-left so the DOM z-index works
          const expandedTasks = expandedIds
            .map((id) => openTasks.find((ot) => ot.id === id))
            .filter(
              (ot): ot is { id: string; archived?: boolean; data?: TaskDto } =>
                !!ot,
            );

          // Position calculation:
          // Folded strips are stacked at the far right (rightmost)
          // Expanded panels sit to the left of the strips
          const foldedStripWidth = 48;
          const totalFoldedWidth = foldedTasks.length * foldedStripWidth;

          return (
            <div className="fixed top-0 bottom-0 right-0 z-[60] w-full pointer-events-none">
              {/* Folded (title strip) panels — stacked rightmost */}
              {foldedTasks.map((ot, idx) => {
                const task = tasks.find((t) => t.id === ot.id);
                // Each strip is 48px wide, stacked right-to-left
                const rightOffset = idx * foldedStripWidth;
                return (
                  <div
                    key={ot.id}
                    className="pointer-events-auto h-full absolute top-0"
                    style={{
                      right: rightOffset,
                      width: foldedStripWidth,
                      zIndex: 10 + idx,
                      boxShadow: "-4px 0 12px rgba(0,0,0,0.08)",
                      transition: "right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    <TaskDetailSidebar
                      task={
                        task ||
                        ot.data ||
                        stableShells.get(ot.id) || { taskId: ot.id }
                      }
                      orgMembers={orgMembers}
                      projectId={projectId}
                      orgId={orgId}
                      currentOpenTaskIds={openTasks.map((t) => t.id)}
                      revision={sidebarRevision}
                      objectives={objectives}
                      allTags={allTags}
                      isActive={false}
                      isExpanded={false}
                      onActivate={() => handleActivateTask(ot.id)}
                      onFold={undefined}
                      onOpenAsComparison={
                        expandedIds.length > 0
                          ? () => handleOpenAsComparison(ot.id)
                          : undefined
                      }
                      onClose={() => handleCloseTask(ot.id)}
                      showCloseAll={false}
                      onCloseAll={handleCloseAllTasks}
                      width={foldedStripWidth}
                      onWidthChange={() => {}}
                      onUpdated={(updated) => {
                        setTasks((prev) =>
                          prev.map((t) => (t.id === updated.id ? updated : t)),
                        );
                      }}
                      onDeleted={(taskId) => {
                        setTasks((prev) => prev.filter((t) => t.id !== taskId));
                        handleCloseTask(taskId);
                        setArchiveRevision((v) => v + 1);
                      }}
                      onOpenRelatedTask={(relatedId) =>
                        handleOpenTask(relatedId)
                      }
                    />
                  </div>
                );
              })}

              {/* Expanded panels — side by side, to the left of folded strips */}
              {expandedTasks.map((ot, idx) => {
                const task = tasks.find((t) => t.id === ot.id);
                // idx=0 is left panel, idx=1 is right panel
                // Right edge of rightmost expanded panel = totalFoldedWidth
                // Right edge of left panel = totalFoldedWidth + rightPanelWidth
                const rightPanelWidth =
                  panelWidths[expandedTasks[expandedTasks.length - 1]?.id] ||
                  384;
                const rightOffset =
                  idx === expandedTasks.length - 1
                    ? totalFoldedWidth
                    : totalFoldedWidth + rightPanelWidth;

                return (
                  <div
                    key={ot.id}
                    className="pointer-events-auto h-full absolute top-0"
                    style={{
                      right: rightOffset,
                      zIndex: 20 + idx,
                      boxShadow: "-10px 0 30px rgba(0,0,0,0.15)",
                      transition: "right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
                    }}
                  >
                    <TaskDetailSidebar
                      task={
                        task ||
                        ot.data ||
                        stableShells.get(ot.id) || { taskId: ot.id }
                      }
                      orgMembers={orgMembers}
                      projectId={projectId}
                      orgId={orgId}
                      currentOpenTaskIds={openTasks.map((t) => t.id)}
                      revision={sidebarRevision}
                      objectives={objectives}
                      allTags={allTags}
                      isActive={idx === expandedTasks.length - 1}
                      isExpanded={true}
                      onActivate={() => handleActivateTask(ot.id)}
                      onFold={
                        idx === 0 && expandedTasks.length > 1
                          ? () => handleFoldPanel(ot.id)
                          : undefined
                      }
                      onClose={() => handleCloseTask(ot.id)}
                      showCloseAll={
                        openTasks.length > 1 && idx === expandedTasks.length - 1
                      }
                      onCloseAll={handleCloseAllTasks}
                      width={panelWidths[ot.id] || 384}
                      onWidthChange={(w) => {
                        setPanelWidths((prev) => ({ ...prev, [ot.id]: w }));
                      }}
                      onUpdated={(updated) => {
                        setTasks((prev) =>
                          prev.map((t) => (t.id === updated.id ? updated : t)),
                        );
                      }}
                      onDeleted={(taskId) => {
                        setTasks((prev) => prev.filter((t) => t.id !== taskId));
                        handleCloseTask(taskId);
                        setArchiveRevision((v) => v + 1);
                      }}
                      onOpenRelatedTask={(relatedId) =>
                        handleOpenTask(relatedId)
                      }
                    />
                  </div>
                );
              })}
            </div>
          );
        })()}

      {showImport && (
        <CsvImportModal
          projectId={projectId}
          onClose={() => setShowImport(false)}
          onImported={() => setShowImport(false)}
        />
      )}

      {newTaskColumn !== null && (
        <NewTaskModal
          projectId={projectId}
          orgId={orgId}
          initialColumn={newTaskColumn}
          orgMembers={orgMembers}
          objectives={objectives}
          allTags={allTags}
          onClose={() => setNewTaskColumn(null)}
          onCreated={(task) => {
            setTasks((prev) =>
              prev.some((t) => t.id === task.id) ? prev : [...prev, task],
            );
            setNewTaskColumn(null);
          }}
        />
      )}
    </div>
  );
}
