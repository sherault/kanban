'use client'

import { useState, useTransition } from 'react'
import type { TaskDto, MembershipDto } from '@kanban/shared'
import { updateTaskAction, deleteTaskAction } from '@/actions/tasks'

interface Props {
  task: TaskDto
  orgMembers: MembershipDto[]
  projectId: string
  onClose: () => void
  onUpdated: (task: TaskDto) => void
  onDeleted: (taskId: string) => void
}

const COLUMN_BADGE: Record<string, string> = {
  ideas: 'bg-purple-100 text-purple-700',
  todo: 'bg-gray-100 text-gray-700',
  doing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

export function TaskDetailSidebar({
  task,
  orgMembers,
  projectId,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

  function save(body: Parameters<typeof updateTaskAction>[2]) {
    setSaveError(null)
    startTransition(async () => {
      const result = await updateTaskAction(projectId, task.id, body)
      if (result.error) setSaveError(result.error)
      else if (result.task) onUpdated(result.task)
    })
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true)
      return
    }
    startTransition(async () => {
      const result = await deleteTaskAction(projectId, task.id)
      if (result.error) setSaveError(result.error)
      else onDeleted(task.id)
    })
  }

  return (
    <aside className="w-96 border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${COLUMN_BADGE[task.column] ?? 'bg-gray-100 text-gray-700'}`}
        >
          {task.column}
        </span>
        <div className="flex items-center gap-3">
          {isPending && <span className="text-xs text-gray-400">Saving…</span>}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-5 space-y-5 overflow-y-auto">
        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">
            {saveError}
          </div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Title
          </label>
          <input
            key={task.id + '-title'}
            defaultValue={task.title}
            onBlur={(e) => {
              const v = e.target.value.trim()
              if (v && v !== task.title) save({ title: v })
            }}
            className="w-full text-sm font-medium text-gray-900 border border-transparent rounded px-2 py-1.5 hover:border-gray-200 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Description
          </label>
          <textarea
            key={task.id + '-desc'}
            defaultValue={task.description ?? ''}
            rows={4}
            placeholder="Add a description…"
            onBlur={(e) => {
              const v = e.target.value || null
              if (v !== task.description) save({ description: v })
            }}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Start
            </label>
            <input
              key={task.id + '-start'}
              type="date"
              defaultValue={task.startDate}
              onBlur={(e) => {
                if (e.target.value && e.target.value !== task.startDate)
                  save({ startDate: e.target.value })
              }}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              End
            </label>
            <input
              key={task.id + '-end'}
              type="date"
              defaultValue={task.endDate}
              onBlur={(e) => {
                if (e.target.value && e.target.value !== task.endDate)
                  save({ endDate: e.target.value })
              }}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* Doer */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Doer
          </label>
          <select
            key={task.id + '-doer'}
            defaultValue={task.doer?.id ?? ''}
            onChange={(e) => save({ doerId: e.target.value || null })}
            className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400"
          >
            <option value="">— Unassigned —</option>
            {orgMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Validator */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Validator
          </label>
          <select
            key={task.id + '-validator'}
            defaultValue={task.validator?.id ?? ''}
            onChange={(e) => save({ validatorId: e.target.value || null })}
            className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400"
          >
            <option value="">— Unassigned —</option>
            {orgMembers.map((m) => (
              <option key={m.userId} value={m.userId}>
                {m.user.displayName}
              </option>
            ))}
          </select>
        </div>

        {/* Reporter (read-only) */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
            Reporter
          </label>
          <p className="text-sm text-gray-700 px-2 py-1.5">{task.reporter.displayName}</p>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-200 shrink-0">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 flex-1">Delete this task?</span>
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
  )
}
