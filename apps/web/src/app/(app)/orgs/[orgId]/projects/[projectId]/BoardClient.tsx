"use client";

import { useEffect, useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import type { Column} from "@kanban/shared";
import { type TaskDto } from "@kanban/shared";
import type { NotificationData } from "@/components/NotificationsOverlay";
import { ArchivePanel } from "./ArchivePanel";
import { TaskCard } from "./TaskCard";
import { BoardColumns } from "./board-client/BoardColumns";
import { BoardErrorBanner } from "./board-client/BoardErrorBanner";
import { BoardFilters } from "./board-client/BoardFilters";
import { BoardOverlays } from "./board-client/BoardOverlays";
import { BoardToolbar } from "./board-client/BoardToolbar";
import { useBoardInteractions } from "./board-client/useBoardInteractions";
import { useBoardPanels } from "./board-client/useBoardPanels";
import { useBoardRealtime } from "./board-client/useBoardRealtime";
import type { BoardClientProps } from "./board-client/types";

export function BoardClient({
  initialTasks,
  orgMembers,
  projectId,
  orgId,
  currentUserId,
  maxOpenPanels,
  enableNotifications,
  maxNotifications,
  notificationDuration,
}: BoardClientProps) {
  const [tasks, setTasks] = useState<TaskDto[]>(initialTasks);
  const [isMounted, setIsMounted] = useState(false);
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [archiveRevision, setArchiveRevision] = useState(0);
  const [newTaskColumn, setNewTaskColumn] = useState<Column | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [ideasCollapsed, setIdeasCollapsed] = useState(true);
  const [sidebarRevision, setSidebarRevision] = useState(0);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [activeObjective, setActiveObjective] = useState<string | null>(null);
  const [activeDoerId, setActiveDoerId] = useState<string | null>(null);

  useEffect(() => setIsMounted(true), []);
  useEffect(() => setTasks(initialTasks), [initialTasks]);

  const panels = useBoardPanels({ orgId, maxOpenPanels, isMounted });
  const interactions = useBoardInteractions({
    tasks,
    setTasks,
    orgMembers,
    currentUserId,
    projectId,
  });
  const { isConnected } = useBoardRealtime({
    projectId,
    currentUserId,
    enableNotifications,
    notificationDuration,
    tasks,
    openTasks: panels.openTasks,
    setTasks,
    setOpenTasks: panels.setOpenTasks,
    setExpandedIds: panels.setExpandedIds,
    setSelectedDoneIds: interactions.setSelectedDoneIds,
    setArchiveRevision,
    setSidebarRevision,
    setNotifications,
  });

  useEffect(() => {
    const handleOpenEvent = (event: Event) => {
      if (!(event instanceof CustomEvent) || typeof event.detail !== "string") {
        return;
      }
      panels.handleOpenTask(event.detail);
    };
    window.addEventListener("kanban_open_task", handleOpenEvent);
    return () =>
      window.removeEventListener("kanban_open_task", handleOpenEvent);
  }, [panels]);

  const objectives = useMemo(
    () => [
      ...new Set(
        tasks.flatMap((task) => (task.objective ? [task.objective] : [])),
      ),
    ],
    [tasks],
  );
  const allTags = useMemo(
    () => [...new Set(tasks.flatMap((task) => task.tags))],
    [tasks],
  );
  const activeDoerName = activeDoerId
    ? (tasks.find((task) => task.doer?.id === activeDoerId)?.doer
        ?.displayName ?? activeDoerId)
    : null;
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  return (
    <div className="flex h-full overflow-hidden relative">
      <DndContext
        id="board-dnd"
        sensors={sensors}
        onDragStart={interactions.handleDragStart}
        onDragEnd={interactions.handleDragEnd}
      >
        <div className="flex-1 flex flex-col overflow-hidden min-h-0">
          <BoardErrorBanner
            error={interactions.error}
            onClear={() => interactions.setError(null)}
          />
          <BoardFilters
            activeTag={activeTag}
            activeObjective={activeObjective}
            activeDoerName={activeDoerName}
            activeDoerId={activeDoerId}
            onClearTag={() => setActiveTag(null)}
            onClearObjective={() => setActiveObjective(null)}
            onClearDoer={() => setActiveDoerId(null)}
            onClearAll={() => {
              setActiveTag(null);
              setActiveObjective(null);
              setActiveDoerId(null);
            }}
          />
          <BoardColumns
            tasks={tasks}
            sidebarTotalWidth={panels.sidebarTotalWidth}
            ideasCollapsed={ideasCollapsed}
            activeTag={activeTag}
            activeObjective={activeObjective}
            activeDoerId={activeDoerId}
            selectedDoneIds={interactions.selectedDoneIds}
            onToggleIdeas={() => setIdeasCollapsed((value) => !value)}
            onOpenTask={panels.handleOpenTask}
            onOpenAsComparison={panels.handleOpenAsComparison}
            onNewTask={setNewTaskColumn}
            onTagClick={setActiveTag}
            onObjectiveClick={setActiveObjective}
            onDoerClick={setActiveDoerId}
            onSelectionChange={interactions.handleDoneSelection}
          />
          <BoardToolbar
            sidebarTotalWidth={panels.sidebarTotalWidth}
            selectedDoneCount={interactions.selectedDoneIds.size}
            archiving={interactions.archiving}
            isConnected={isConnected}
            onShowImport={() => setShowImport(true)}
            onArchiveSelected={() => void interactions.handleArchiveSelected()}
          />
          <ArchivePanel
            projectId={projectId}
            onRestored={(task) => setTasks((prev) => upsertTask(prev, task))}
            onTaskClick={(task) => panels.handleOpenTask(task.id, true)}
            refreshTrigger={archiveRevision}
          />
        </div>

        <DragOverlay>
          {interactions.activeTask ? (
            <TaskCard
              task={interactions.activeTask}
              onClick={() => {}}
              overlay
            />
          ) : null}
        </DragOverlay>
      </DndContext>

      <BoardOverlays
        isMounted={isMounted}
        showImport={showImport}
        newTaskColumn={newTaskColumn}
        notifications={notifications}
        enableNotifications={enableNotifications}
        maxNotifications={maxNotifications}
        panels={panels}
        tasks={tasks}
        orgMembers={orgMembers}
        projectId={projectId}
        orgId={orgId}
        sidebarRevision={sidebarRevision}
        objectives={objectives}
        allTags={allTags}
        setTasks={setTasks}
        setShowImport={setShowImport}
        setNewTaskColumn={setNewTaskColumn}
        setNotifications={setNotifications}
        setArchiveRevision={setArchiveRevision}
      />
    </div>
  );
}
function upsertTask(tasks: TaskDto[], task: TaskDto) {
  const idx = tasks.findIndex((item) => item.id === task.id);
  if (idx < 0) return [...tasks, task];
  const next = [...tasks];
  next[idx] = task;
  return next;
}
