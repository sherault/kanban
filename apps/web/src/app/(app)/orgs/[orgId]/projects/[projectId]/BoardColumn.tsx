'use client'

import { useDroppable } from '@dnd-kit/core'
import type { TaskDto } from '@kanban/shared'
import { Column } from '@kanban/shared'
import { TaskCard } from './TaskCard'

interface Props {
  column: Column
  label: string
  tasks: TaskDto[]
  collapsed: boolean
  onToggleCollapse?: () => void
  onTaskClick: (taskId: string) => void
  onNewTask: () => void
  onTagClick: (tag: string) => void
  onObjectiveClick?: (objective: string) => void
  onDoerClick?: (userId: string) => void
  selectable?: boolean
  selectedIds?: Set<string>
  onSelectionChange?: (id: string, selected: boolean) => void
}

const COLUMN_DOT: Record<Column, string> = {
  [Column.IDEAS]: 'bg-purple-400',
  [Column.TODO]: 'bg-gray-400',
  [Column.DOING]: 'bg-blue-500',
  [Column.DONE]: 'bg-green-500',
}

export function BoardColumn({
  column,
  label,
  tasks,
  collapsed,
  onToggleCollapse,
  onTaskClick,
  onNewTask,
  onTagClick,
  onObjectiveClick,
  onDoerClick,
  selectable = false,
  selectedIds,
  onSelectionChange,
}: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column })

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-3 w-10 shrink-0 pt-1">
        <div className={`w-2 h-2 rounded-full shrink-0 ${COLUMN_DOT[column]}`} />
        <button
          onClick={onToggleCollapse}
          className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          style={{ writingMode: 'vertical-rl' as const, transform: 'rotate(180deg)' }}
        >
          {label} ({tasks.length})
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col w-72 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${COLUMN_DOT[column]}`} />
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">
            {tasks.length}
          </span>
        </div>
        {onToggleCollapse && (
          <button onClick={onToggleCollapse} className="text-xs text-gray-400 hover:text-gray-600">
            ←
          </button>
        )}
      </div>

      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col gap-2 min-h-32 rounded-lg p-2 transition-colors ${
          isOver ? 'bg-blue-50 ring-2 ring-blue-200' : 'bg-gray-100/50'
        }`}
      >
        {tasks
          .map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick(task.id)}
              selectable={selectable}
              selected={selectedIds?.has(task.id) ?? false}
              onSelectChange={(sel) => onSelectionChange?.(task.id, sel)}
              onTagClick={onTagClick}
              onObjectiveClick={onObjectiveClick}
              onDoerClick={onDoerClick}
            />
          ))}

        {(column === Column.IDEAS || column === Column.TODO) && (
          <button
            onClick={onNewTask}
            className="mt-1 w-full text-sm text-gray-400 hover:text-gray-600 hover:bg-white rounded-md py-2 transition-colors text-left px-3 border border-dashed border-gray-200 hover:border-gray-300"
          >
            + New task
          </button>
        )}
      </div>
    </div>
  )
}
