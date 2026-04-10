'use client'

import { useActionState, useEffect } from 'react'
import { useFormStatus } from 'react-dom'
import { Column } from '@kanban/shared'
import type { TaskDto } from '@kanban/shared'
import { createTaskAction } from '@/actions/tasks'

function today() {
  return new Date().toISOString().split('T')[0]
}
function todayPlus2() {
  const d = new Date()
  d.setDate(d.getDate() + 2)
  return d.toISOString().split('T')[0]
}

function SubmitButton() {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
    >
      {pending ? 'Creating…' : 'Create task'}
    </button>
  )
}

interface Props {
  projectId: string
  orgId: string
  initialColumn: Column
  onClose: () => void
  onCreated: (task: TaskDto) => void
}

export function NewTaskModal({ projectId, orgId, initialColumn, onClose, onCreated }: Props) {
  const action = createTaskAction.bind(null, projectId, orgId)
  const [state, formAction] = useActionState(action, {})

  useEffect(() => {
    if (state.task) onCreated(state.task)
  }, [state.task])

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">New task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            ×
          </button>
        </div>

        <form action={formAction} className="p-6 space-y-4">
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">
              {state.error}
            </div>
          )}

          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title" name="title" type="text" required autoFocus maxLength={500}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Column</label>
            <div className="flex gap-4">
              {([Column.IDEAS, Column.TODO] as const).map((col) => (
                <label key={col} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio" name="column" value={col}
                    defaultChecked={col === initialColumn}
                    className="text-blue-600"
                  />
                  <span className="text-sm text-gray-700 capitalize">{col}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                Start date
              </label>
              <input
                id="startDate" name="startDate" type="date"
                defaultValue={today()} required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                End date
              </label>
              <input
                id="endDate" name="endDate" type="date"
                defaultValue={todayPlus2()} required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2"
            >
              Cancel
            </button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  )
}
