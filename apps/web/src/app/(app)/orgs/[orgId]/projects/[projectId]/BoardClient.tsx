'use client'

import { useState, useTransition } from 'react'
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { TaskDto, MembershipDto } from '@kanban/shared'
import { Column } from '@kanban/shared'
import { moveTaskAction } from '../../../../../actions/tasks'
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

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

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
        // Revert
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

  return (
    <div className="flex h-full overflow-hidden">
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex flex-col overflow-hidden">
          {error && (
            <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2 flex items-center justify-between shrink-0">
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600 text-lg leading-none">×</button>
            </div>
          )}
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
