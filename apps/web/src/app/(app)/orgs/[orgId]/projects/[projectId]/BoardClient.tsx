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
import { moveTaskAction } from '@/actions/tasks'
import { useProjectSocket } from '@/hooks/useProjectSocket'
import { TaskCard } from './TaskCard'
import { BoardColumn } from './BoardColumn'
import { NewTaskModal } from './NewTaskModal'
import { TaskDetailSidebar } from './TaskDetailSidebar'

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
}

export function BoardClient({ initialTasks, orgMembers, projectId, orgId }: Props) {
  const [tasks, setTasks] = useState<TaskDto[]>(initialTasks)
  const [activeTask, setActiveTask] = useState<TaskDto | null>(null)
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)
  const [newTaskColumn, setNewTaskColumn] = useState<Column | null>(null)
  const [ideasCollapsed, setIdeasCollapsed] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  // Keep a ref to selectedTaskId so WS callbacks (closures) always read
  // the latest value without needing to be recreated on every render.
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
      // Ignore if we already have the task (e.g. from our own Server Action)
      setTasks((prev) => (prev.some((t) => t.id === task.id) ? prev : [...prev, task]))
    },
    onTaskUpdated(task) {
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== task.id) return t
          // Don't overwrite a task the user has open in the sidebar —
          // their in-progress edits take precedence until they close it.
          if (selectedTaskIdRef.current === task.id) return t
          return task
        })
      )
    },
    onTaskDeleted(taskId) {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      if (selectedTaskIdRef.current === taskId) setSelectedTaskId(null)
    },
  })

  // ── Drag and drop ─────────────────────────────────────────────────────────

  const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null

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

    if (newColumn === Column.DOING && !task.doer) {
      setError('Assign a doer to this task before moving it to Doing.')
      return
    }

    // Optimistic update
    setTasks((prev) =>
      prev.map((t) => (t.id === taskId ? { ...t, column: newColumn } : t))
    )

    startTransition(async () => {
      const result = await moveTaskAction(projectId, taskId, newColumn)
      if (result.error) {
        // Revert to original column
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, column: task.column } : t))
        )
        setError(result.error)
      } else if (result.task) {
        setTasks((prev) =>
          prev.map((t) => (t.id === result.task!.id ? result.task! : t))
        )
      }
    })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex flex-col overflow-hidden">
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

          {/* Board columns */}
          <div className="flex gap-4 p-6 overflow-x-auto flex-1 items-start">
            {COLUMNS.map(({ id, label }) => (
              <BoardColumn
                key={id}
                column={id}
                label={label}
                tasks={tasks.filter((t) => t.column === id)}
                collapsed={id === Column.IDEAS ? ideasCollapsed : false}
                onToggleCollapse={
                  id === Column.IDEAS ? () => setIdeasCollapsed((v) => !v) : undefined
                }
                onTaskClick={(taskId) => setSelectedTaskId(taskId)}
                onNewTask={() => setNewTaskColumn(id)}
              />
            ))}
          </div>

          {/* Connection status indicator */}
          <div className="px-6 pb-3 flex items-center gap-1.5 shrink-0">
            <span
              className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-400' : 'bg-gray-300'}`}
            />
            <span className="text-xs text-gray-400">
              {isConnected ? 'Live' : 'Connecting…'}
            </span>
          </div>
        </div>

        <DragOverlay>
          {activeTask ? <TaskCard task={activeTask} onClick={() => {}} overlay /> : null}
        </DragOverlay>
      </DndContext>

      {selectedTask && (
        <TaskDetailSidebar
          task={selectedTask}
          orgMembers={orgMembers}
          projectId={projectId}
          onClose={() => setSelectedTaskId(null)}
          onUpdated={(updated) =>
            setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
          }
          onDeleted={(taskId) => {
            setTasks((prev) => prev.filter((t) => t.id !== taskId))
            setSelectedTaskId(null)
          }}
        />
      )}

      {newTaskColumn !== null && (
        <NewTaskModal
          projectId={projectId}
          orgId={orgId}
          initialColumn={newTaskColumn}
          onClose={() => setNewTaskColumn(null)}
          onCreated={(task) => {
            setTasks((prev) => [...prev, task])
            setNewTaskColumn(null)
          }}
        />
      )}
    </div>
  )
}
