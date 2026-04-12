'use client'

import { useActionState, useEffect, useState } from 'react'
import { useFormStatus } from 'react-dom'
import { Column } from '@kanban/shared'
import type { TaskDto, MembershipDto } from '@kanban/shared'
import { createTaskAction } from '@/actions/tasks'
import { ColorPicker } from './ColorPicker'
import { DescriptionEditor } from './DescriptionEditor'

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
  orgMembers: MembershipDto[]
  objectives: string[]
  allTags: string[]
  onClose: () => void
  onCreated: (task: TaskDto) => void
}

export function NewTaskModal({ projectId, orgId, initialColumn, orgMembers, objectives, allTags, onClose, onCreated }: Props) {
  const action = createTaskAction.bind(null, projectId, orgId)
  const [state, formAction] = useActionState(action, {})
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [backgroundColor, setBackgroundColor] = useState<string | null>(null)
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (state.task) onCreated(state.task)
  }, [state.task, onCreated])

  function handleTagKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && tagInput.trim()) {
      e.preventDefault()
      const t = tagInput.trim().toLowerCase()
      if (!tags.includes(t)) setTags((prev) => [...prev, t])
      setTagInput('')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-base font-semibold text-gray-900">New task</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <form action={formAction} className="p-6 space-y-4">
          {state.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2">{state.error}</div>
          )}

          {/* Title */}
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              id="title" name="title" type="text" required autoFocus maxLength={500}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            {description && <input type="hidden" name="description" value={description} />}
            <DescriptionEditor
              value={description}
              onChange={setDescription}
              onFocus={() => {}}
              onBlur={() => {}}
              placeholder="Optional description…"
            />
          </div>

          {/* Objective */}
          <div>
            <label htmlFor="objective" className="block text-sm font-medium text-gray-700 mb-1">Objective</label>
            <input
              id="objective"
              name="objective"
              type="text"
              list="new-task-objectives"
              placeholder="Optional objective…"
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <datalist id="new-task-objectives">
              {objectives.map((o) => <option key={o} value={o} />)}
            </datalist>
          </div>

          {/* Column */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Column</label>
            <div className="flex gap-4">
              {([Column.IDEAS, Column.TODO] as const).map((col) => (
                <label key={col} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="column" value={col} defaultChecked={col === initialColumn} className="text-blue-600" />
                  <span className="text-sm text-gray-700 capitalize">{col}</span>
                </label>
              ))}
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
            {/* Hidden inputs carry the tags into formData */}
            {tags.map((t) => <input key={t} type="hidden" name="tags" value={t} />)}
            <div className="flex flex-wrap gap-1 border border-gray-300 rounded-md px-3 py-2 min-h-[40px] focus-within:ring-2 focus-within:ring-blue-500">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                  {t}
                  <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="text-gray-400 hover:text-gray-600">&times;</button>
                </span>
              ))}
              <input
                list="new-task-tags"
                value={tagInput}
                onChange={(e) => {
                  const val = e.target.value
                  const normalized = val.trim().toLowerCase()
                  if (allTags.includes(normalized) && !tags.includes(normalized)) {
                    setTags((prev) => [...prev, normalized])
                    setTagInput('')
                  } else {
                    setTagInput(val)
                  }
                }}
                onKeyDown={handleTagKey}
                placeholder={tags.length === 0 ? 'Add tag, press Enter…' : ''}
                className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
              />
              <datalist id="new-task-tags">
                {allTags.filter((t) => !tags.includes(t)).map((t) => <option key={t} value={t} />)}
              </datalist>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">Start date</label>
              <input id="startDate" name="startDate" type="date" defaultValue={today()} required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">End date</label>
              <input id="endDate" name="endDate" type="date" defaultValue={todayPlus2()} required
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          </div>

          {/* Background color + Reporter */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Color</label>
              {backgroundColor && <input type="hidden" name="backgroundColor" value={backgroundColor} />}
              <ColorPicker value={backgroundColor} onChange={setBackgroundColor} />
            </div>
            {orgMembers.length > 0 && (
              <div>
                <label htmlFor="reporterId" className="block text-sm font-medium text-gray-700 mb-1">Reporter</label>
                <select id="reporterId" name="reporterId"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {orgMembers.map((m) => <option key={m.userId} value={m.userId}>{m.user.displayName}</option>)}
                </select>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="text-sm text-gray-500 hover:text-gray-700 px-4 py-2">Cancel</button>
            <SubmitButton />
          </div>
        </form>
      </div>
    </div>
  )
}
