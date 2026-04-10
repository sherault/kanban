'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { TaskDto } from '@kanban/shared'

interface Props {
  task: TaskDto
  onClick: () => void
  overlay?: boolean
}

export function TaskCard({ task, onClick, overlay = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    ...(task.backgroundColor ? { backgroundColor: task.backgroundColor } : {}),
  }

  const isOverdue = new Date(task.endDate) < new Date()
  const initials = task.doer
    ? task.doer.displayName
        .split(' ')
        .map((n) => n[0] ?? '')
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : null

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`bg-white rounded-lg border border-gray-200 p-3 cursor-pointer select-none transition-shadow ${
        isDragging ? 'opacity-40 shadow-lg' : 'hover:shadow-sm hover:border-gray-300'
      } ${overlay ? 'shadow-xl rotate-2 opacity-90' : ''}`}
    >
      <p className="text-sm text-gray-900 font-medium leading-snug mb-2 line-clamp-2">
        {task.title}
      </p>

      <div className="flex items-center justify-between gap-2">
        <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
          {new Date(task.endDate).toLocaleDateString('en', { month: 'short', day: 'numeric' })}
        </span>
        {initials && (
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold shrink-0">
            {initials}
          </span>
        )}
      </div>

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {task.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
              {tag}
            </span>
          ))}
          {task.tags.length > 3 && (
            <span className="text-xs text-gray-400">+{task.tags.length - 3}</span>
          )}
        </div>
      )}
    </div>
  )
}
