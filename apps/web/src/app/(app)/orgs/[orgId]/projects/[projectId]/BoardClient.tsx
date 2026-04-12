'use client'

import { useState, useTransition, useRef, useEffect } from 'react'
import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { TaskDto, MembershipDto } from '@kanban/shared'
import { Column } from '@kanban/shared'
import { moveTaskAction, archiveTasksAction } from '@/actions/tasks'
import { useProjectSocket } from '@/hooks/useProjectSocket'
import { TaskCard } from './TaskCard'
import { BoardColumn } from './BoardColumn'
import { NewTaskModal } from './NewTaskModal'
import { TaskDetailSidebar } from './TaskDetailSidebar'
import { CsvImportModal } from './CsvImportModal'
import { ArchivePanel } from './ArchivePanel'

const COLUMNS: { id: Column; label: string }[] = [
  { id: Column.IDEAS, label: 'Ideas' },
  { id: Column.TODO, label: 'To Do' },
  { id: Column.DOING, label: 'Doing' },
  { id: Column.DONE, label: 'Done' },
]

interface Props {
  initialTasks: TaskDto[]
  orgMembers: MembershipDto[]
  projectId: string
  orgId: string
  currentUserId: string
}

export function BoardClient({ initialTasks, orgMembers, projectId, orgId, currentUserId }: Props) {
  const [tasks, setTasks] = useState<TaskDto[]>(initialTasks)
  const [activeTask, setActiveTask] = useState<TaskDto | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [newTaskColumn, setNewTaskColumn] = useState<Column | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [ideasCollapsed, setIdeasCollapsed] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sidebarRevision, setSidebarRevision] = useState(0)
  const [selectedDoneIds, setSelectedDoneIds] = useState<Set<string>>(new Set())
  const [archiving, setArchiving] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [selectedArchivedTask, setSelectedArchivedTask] = useState<TaskDto | null>(null)
  const [, startTransition] = useTransition()

  // Stable ref to selectedTaskId for WS callbacks
  const selectedTaskIdRef = useRef<string | null>(null)
  useEffect(() => {
    selectedTaskIdRef.current = selectedTaskId
  }, [selectedTaskId])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  // ── WebSocket real-time ───────────────────────────────────────────────────

  const { isConnected } = useProjectSocket(projectId, {
    onTaskCreated(task) {
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]))
    },
    onTaskUpdated(task) {
      // Always update state — the sidebar uses uncontrolled inputs (defaultValue)
      // so in-progress text edits are preserved automatically.
      setTasks((prev) => prev.map((t) => (t.id !== task.id ? t : task)))

      // If the updated task is open in the sidebar, bump the revision to
      // remount it with fresh values — but only when no sidebar field has focus
      // (i.e. the user isn't actively typing).
      if (selectedTaskIdRef.current === task.id) {
        const focused = document.activeElement
        const sidebarHasFocus = focused?.closest('[data-sidebar="true"]') ?? false
        if (!sidebarHasFocus) {
          setSidebarRevision((v) => v + 1)
        }
      }
    },
    onTaskDeleted(taskId) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      setSelectedDoneIds((prev) => { const next = new Set(prev); next.delete(taskId); return next })
      if (selectedTaskIdRef.current === taskId) setSelectedTaskId(null)
    },
  })

  // ── Drag and drop ─────────────────────────────────────────────────────────

  const selectedBoardTask = tasks.find((t) => t.id === selectedTaskId) ?? null
  const selectedTask = selectedArchivedTask ?? selectedBoardTask

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((t) => t.id === event.active.id) ?? null)
    setError(null)
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null)
    const { active, over } = event
    if (!over) return

    const taskId = active.id as string
    const newColumn = over.id as Column
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.column === newColumn) return

    // When moving to "doing" with no doer, the API auto-assigns the current
    // user — optimistically reflect that in local state.
    const optimisticDoer =
      newColumn === Column.DOING && !task.doer
        ? orgMembers.find((m) => m.userId === currentUserId)
        : null

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) =>
        t.id === taskId
          ? {
              ...t,
              column: newColumn,
              ...(optimisticDoer
                ? { doer: { id: optimisticDoer.userId, displayName: optimisticDoer.user.displayName } }
                : {}),
            }
          : t
      )
    )

    startTransition(async () => {
      const result = await moveTaskAction(projectId, taskId, newColumn)
      if (result.error) {
        // Revert to original state
        setTasks((prev) => prev.map((t) => (t.id === taskId ? task : t)))
        setError(result.error)
      } else if (result.task) {
        setTasks((prev) => prev.map((t) => (t.id === result.task!.id ? result.task! : t)))
      }
    })
  }

  // ── Archive ───────────────────────────────────────────────────────────────

  async function handleArchiveSelected() {
    if (selectedDoneIds.size === 0) return
    setArchiving(true)
    const ids = Array.from(selectedDoneIds)
    const result = await archiveTasksAction(projectId, ids)
    setArchiving(false)
    if (result.error) {
      setError(result.error)
    } else {
      setTasks((prev) => prev.filter((t) => !ids.includes(t.id)))
      setSelectedDoneIds(new Set())
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      <DndContext id="board-dnd" sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
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

          {/* Tag filter bar */}
          {activeTag && (
            <div className="mx-6 mt-4 flex items-center gap-2 shrink-0">
              <span className="text-xs text-gray-500">Filtered by tag:</span>
              <span className="inline-flex items-center gap-1.5 text-xs bg-blue-100 text-blue-700 font-medium px-2 py-1 rounded-full">
                {activeTag}
                <button
                  onClick={() => setActiveTag(null)}
                  className="text-blue-500 hover:text-blue-800 leading-none"
                  aria-label="Clear tag filter"
                >
                  ×
                </button>
              </span>
            </div>
          )}

          {/* Board columns */}
          <div className="flex gap-4 p-6 overflow-x-auto flex-1 items-start">
            {COLUMNS.map(({ id, label }) => {
              const columnTasks = tasks.filter((t) =>
                t.column === id && (!activeTag || t.tags.includes(activeTag))
              )
              return (
                <BoardColumn
                  key={id}
                  column={id}
                  label={label}
                  tasks={columnTasks}
                  collapsed={id === Column.IDEAS ? ideasCollapsed : false}
                  onToggleCollapse={
                    id === Column.IDEAS ? () => setIdeasCollapsed((v) => !v) : undefined
                  }
                  onTaskClick={(taskId) => { setSelectedArchivedTask(null); setSelectedTaskId(taskId) }}
                  onNewTask={() => setNewTaskColumn(id)}
                  onTagClick={(tag) => setActiveTag(tag)}
                  selectable={id === Column.DONE}
                  selectedIds={id === Column.DONE ? selectedDoneIds : undefined}
                  onSelectionChange={id === Column.DONE ? (tid, sel) => {
                    setSelectedDoneIds((prev) => {
                      const next = new Set(prev)
                      if (sel) next.add(tid); else next.delete(tid)
                      return next
                    })
                  } : undefined}
                />
              )
            })}
          </div>

          {/* Toolbar */}
          <div className="px-6 pb-3 flex items-center justify-between shrink-0">
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
                  {archiving ? 'Archiving...' : `Archive ${selectedDoneIds.size} task${selectedDoneIds.size > 1 ? 's' : ''}`}
                </button>
              )}
            </div>
            {/* Connection status indicator */}
            <div className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-300'}`}
              />
              <span className="text-xs text-gray-400">
                {isConnected ? 'Live' : 'Connecting…'}
              </span>
            </div>
          </div>

          {/* Archive panel */}
          <ArchivePanel
            projectId={projectId}
            onRestored={(task) => {
              setTasks((prev) => prev.some((t) => t.id === task.id) ? prev : [...prev, task])
              setSelectedArchivedTask(null)
            }}
            onTaskClick={(task) => {
              setSelectedTaskId(null)
              setSelectedArchivedTask(task)
            }}
          />
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} onClick={() => {}} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {selectedTask && (
        <TaskDetailSidebar
          key={selectedTask.id}
          task={selectedTask}
          orgMembers={orgMembers}
          projectId={projectId}
          revision={sidebarRevision}
          onClose={() => { setSelectedTaskId(null); setSelectedArchivedTask(null) }}
          onUpdated={(updated) => {
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
            if (selectedArchivedTask?.id === updated.id) setSelectedArchivedTask(updated)
          }}
          onDeleted={(taskId) => {
            setTasks((prev) => prev.filter((t) => t.id !== taskId))
            setSelectedTaskId(null)
            setSelectedArchivedTask(null)
          }}
        />
      )}

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
          onClose={() => setNewTaskColumn(null)}
          onCreated={(task) => {
            setTasks((prev) => prev.some((t) => t.id === task.id) ? prev : [...prev, task])
            setNewTaskColumn(null)
          }}
        />
      )}
    </div>
  )
}
