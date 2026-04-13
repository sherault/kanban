'use client'

import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import type { TaskDto } from '@kanban/shared'

interface Props {
  task: TaskDto
  onClick: () => void
  overlay?: boolean
  selectable?: boolean
  selected?: boolean
  onSelectChange?: (selected: boolean) => void
  onTagClick?: (tag: string) => void
  onObjectiveClick?: (objective: string) => void
  onDoerClick?: (userId: string) => void
}

export function TaskCard({ task, onClick, overlay = false, selectable = false, selected = false, onSelectChange, onTagClick, onObjectiveClick, onDoerClick }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: task.id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
    ...(task.backgroundColor ? { backgroundColor: task.backgroundColor } : {}),
  }

  const endDateObj = task.endDate ? new Date(task.endDate) : null
  const isOverdue = endDateObj != null && !isNaN(endDateObj.getTime()) && endDateObj < new Date()
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
      className={`relative bg-white rounded-lg border p-3 cursor-pointer select-none transition-shadow ${
        selected ? 'border-blue-400 ring-1 ring-blue-200' : 'border-gray-200'
      } ${
        isDragging ? 'opacity-40 shadow-lg' : 'hover:shadow-sm hover:border-gray-300'
      } ${overlay ? 'shadow-xl rotate-2 opacity-90' : ''}`}
    >
      {selectable && (
        <div
          className="absolute top-2 right-2"
          onClick={e => { e.stopPropagation(); onSelectChange?.(!selected) }}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={e => { e.stopPropagation(); onSelectChange?.(e.target.checked) }}
            onClick={e => e.stopPropagation()}
            className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
          />
        </div>
      )}
      <p className="text-sm text-gray-900 font-medium leading-snug mb-2 line-clamp-2">
        {task.title}
      </p>

      <div className="flex items-center justify-between gap-2">
        {endDateObj && !isNaN(endDateObj.getTime()) && (
          <span className={`text-xs ${isOverdue ? 'text-red-500 font-medium' : 'text-gray-400'}`}>
            {endDateObj.toLocaleDateString('en', { month: 'short', day: 'numeric' })}
          </span>
        )}
        {initials && (
          <span
            onClick={onDoerClick ? (e) => { e.stopPropagation(); onDoerClick(task.doer!.id) } : undefined}
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold shrink-0 ${onDoerClick ? 'cursor-pointer hover:bg-blue-200' : ''}`}
            title={task.doer?.displayName}
          >
            {initials}
          </span>
        )}
      </div>

      {task.objective && (
        <div
          onClick={onObjectiveClick ? (e) => { e.stopPropagation(); onObjectiveClick(task.objective || '') } : undefined}
          className={`text-xs text-gray-400 italic mt-1.5 line-clamp-1 ${onObjectiveClick ? 'cursor-pointer hover:text-purple-600' : ''}`}
          title={task.objective}
        >
          {task.objective}
        </div>
      )}

      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {task.tags.map((tag) => (
            <span
              key={tag}
              onClick={onTagClick ? (e) => { e.stopPropagation(); onTagClick(tag) } : undefined}
              className={`text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded ${onTagClick ? 'hover:bg-blue-100 hover:text-blue-700 cursor-pointer' : ''}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
