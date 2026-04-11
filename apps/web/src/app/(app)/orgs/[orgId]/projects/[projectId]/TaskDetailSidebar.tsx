'use client'

import { useState, useTransition, useEffect, useRef } from 'react'
import type { TaskDto, MembershipDto, TaskHistoryDto, Column } from '@kanban/shared'
import {
  updateTaskAction,
  deleteTaskAction,
  addTagAction,
  removeTagAction,
  addWatcherAction,
  removeWatcherAction,
  addAdvisorAction,
  removeAdvisorAction,
  getTaskHistoryAction,
} from '@/actions/tasks'

interface Props {
  task: TaskDto
  orgMembers: MembershipDto[]
  projectId: string
  onClose: () => void
  onUpdated: (task: TaskDto) => void
  onDeleted: (taskId: string) => void
}

const COLUMN_BADGE: Record<Column, string> = {
  ideas: 'bg-purple-100 text-purple-700',
  todo: 'bg-gray-100 text-gray-700',
  doing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TagInput({ tags, onAdd, onRemove }: { tags: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void }) {
  const [input, setInput] = useState('')

  function handleKey(e: React.KeyboardEvent<HTMLInputElement>) {
    if ((e.key === 'Enter' || e.key === ',') && input.trim()) {
      e.preventDefault()
      onAdd(input.trim().toLowerCase())
      setInput('')
    }
  }

  return (
    <div className="flex flex-wrap gap-1 border border-gray-200 rounded px-2 py-1.5 min-h-[36px] focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400">
      {tags.map((tag) => (
        <span key={tag} className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
          {tag}
          <button onClick={() => onRemove(tag)} className="text-gray-400 hover:text-gray-600 leading-none">&times;</button>
        </span>
      ))}
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder={tags.length === 0 ? 'Add tag, press Enter…' : ''}
        className="flex-1 min-w-[80px] text-xs outline-none bg-transparent"
      />
    </div>
  )
}

function UserChips({
  users,
  orgMembers,
  onAdd,
  onRemove,
}: {
  users: Array<{ id: string; displayName: string }>
  orgMembers: MembershipDto[]
  onAdd: (userId: string) => void
  onRemove: (userId: string) => void
}) {
  const assigned = new Set(users.map((u) => u.id))
  const available = orgMembers.filter((m) => !assigned.has(m.userId))

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {users.map((u) => (
          <span key={u.id} className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
            {u.displayName}
            <button onClick={() => onRemove(u.id)} className="text-blue-400 hover:text-blue-700 leading-none">&times;</button>
          </span>
        ))}
      </div>
      {available.length > 0 && (
        <select
          value=""
          onChange={(e) => { if (e.target.value) { onAdd(e.target.value); e.target.value = '' } }}
          className="w-full text-xs border border-gray-200 rounded px-2 py-1 bg-white focus:outline-none focus:border-blue-400"
        >
          <option value="">+ Add…</option>
          {available.map((m) => (
            <option key={m.userId} value={m.userId}>{m.user.displayName}</option>
          ))}
        </select>
      )}
    </div>
  )
}

function HistoryFeed({ history }: { history: TaskHistoryDto[] }) {
  if (history.length === 0) return <p className="text-xs text-gray-400">No history yet.</p>

  return (
    <ul className="space-y-2">
      {history.map((entry) => (
        <li key={entry.id} className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">{entry.actor.displayName}</span>
          {' changed '}<span className="font-medium">{entry.field}</span>
          {entry.oldValue !== null && (
            <> from <span className="line-through text-gray-400">{entry.oldValue}</span></>
          )}
          {entry.newValue !== null && (
            <> to <span className="text-gray-700">{entry.newValue}</span></>
          )}
          <span className="ml-1 text-gray-400">
            · {new Date(entry.changedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </span>
        </li>
      ))}
    </ul>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const [history, setHistory] = useState<TaskHistoryDto[] | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const historyLoadedRef = useRef(false)

  function save(body: Parameters<typeof updateTaskAction>[2]) {
    setSaveError(null)
    startTransition(async () => {
      const result = await updateTaskAction(projectId, task.id, body)
      if (result.error) setSaveError(result.error)
      else if (result.task) onUpdated(result.task)
    })
  }

  function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    startTransition(async () => {
      const result = await deleteTaskAction(projectId, task.id)
      if (result.error) setSaveError(result.error)
      else onDeleted(task.id)
    })
  }

  function handleTagAdd(tag: string) {
    startTransition(async () => {
      const result = await addTagAction(projectId, task.id, tag)
      if (result.task) onUpdated(result.task)
    })
  }

  function handleTagRemove(tag: string) {
    startTransition(async () => {
      const result = await removeTagAction(projectId, task.id, tag)
      if (result.task) onUpdated(result.task)
    })
  }

  function handleWatcherAdd(userId: string) {
    startTransition(async () => {
      const result = await addWatcherAction(projectId, task.id, userId)
      if (result.task) onUpdated(result.task)
    })
  }

  function handleWatcherRemove(userId: string) {
    startTransition(async () => {
      const result = await removeWatcherAction(projectId, task.id, userId)
      if (result.task) onUpdated(result.task)
    })
  }

  function handleAdvisorAdd(userId: string) {
    startTransition(async () => {
      const result = await addAdvisorAction(projectId, task.id, userId)
      if (result.task) onUpdated(result.task)
    })
  }

  function handleAdvisorRemove(userId: string) {
    startTransition(async () => {
      const result = await removeAdvisorAction(projectId, task.id, userId)
      if (result.task) onUpdated(result.task)
    })
  }

  useEffect(() => {
    if (!showHistory || historyLoadedRef.current) return
    historyLoadedRef.current = true
    void getTaskHistoryAction(projectId, task.id).then((res) => {
      if (res.history) setHistory(res.history)
    })
  }, [showHistory, projectId, task.id])

  return (
    <aside data-sidebar="true" className="w-96 border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${COLUMN_BADGE[task.column] ?? 'bg-gray-100 text-gray-700'}`}>
          {task.column}
        </span>
        <div className="flex items-center gap-3">
          {isPending && <span className="text-xs text-gray-400">Saving…</span>}
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 p-5 space-y-5 overflow-y-auto">
        {saveError && (
          <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded px-3 py-2">{saveError}</div>
        )}

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Title</label>
          <input
            key={task.id + '-title'}
            defaultValue={task.title}
            onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== task.title) save({ title: v }) }}
            className="w-full text-sm font-medium text-gray-900 border border-transparent rounded px-2 py-1.5 hover:border-gray-200 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
          />
        </div>

        {/* Background color */}
        <div className="flex items-center gap-3">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Color</label>
          <input
            key={task.id + '-color'}
            type="color"
            defaultValue={task.backgroundColor ?? '#ffffff'}
            onBlur={(e) => {
              const v = e.target.value === '#ffffff' ? null : e.target.value
              if (v !== task.backgroundColor) save({ backgroundColor: v })
            }}
            className="h-7 w-10 cursor-pointer rounded border border-gray-200"
          />
          {task.backgroundColor && (
            <button
              onClick={() => save({ backgroundColor: null })}
              className="text-xs text-gray-400 hover:text-gray-600"
            >
              Clear
            </button>
          )}
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
          <textarea
            key={task.id + '-desc'}
            defaultValue={task.description ?? ''}
            rows={3}
            placeholder="Add a description…"
            onBlur={(e) => { const v = e.target.value || null; if (v !== task.description) save({ description: v }) }}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
          />
        </div>

        {/* Objective */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Objective</label>
          <textarea
            key={task.id + '-obj'}
            defaultValue={task.objective ?? ''}
            rows={2}
            placeholder="Add an objective…"
            onBlur={(e) => { const v = e.target.value || null; if (v !== task.objective) save({ objective: v }) }}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
          />
        </div>

        {/* Global subject */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Global subject</label>
          <input
            key={task.id + '-subject'}
            defaultValue={task.globalSubject ?? ''}
            placeholder="Epic or global subject…"
            onBlur={(e) => { const v = e.target.value || null; if (v !== task.globalSubject) save({ globalSubject: v }) }}
            className="w-full text-sm text-gray-700 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
        </div>

        {/* Tags */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tags</label>
          <TagInput tags={task.tags} onAdd={handleTagAdd} onRemove={handleTagRemove} />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Start</label>
            <input
              key={task.id + '-start'}
              type="date"
              defaultValue={task.startDate}
              onBlur={(e) => { if (e.target.value && e.target.value !== task.startDate) save({ startDate: e.target.value }) }}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">End</label>
            <input
              key={task.id + '-end'}
              type="date"
              defaultValue={task.endDate}
              onBlur={(e) => { if (e.target.value && e.target.value !== task.endDate) save({ endDate: e.target.value }) }}
              className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
            />
          </div>
        </div>

        {/* People */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Doer</label>
          <select
            key={task.id + '-doer'}
            defaultValue={task.doer?.id ?? ''}
            onChange={(e) => save({ doerId: e.target.value || null })}
            className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400"
          >
            <option value="">— Unassigned —</option>
            {orgMembers.map((m) => <option key={m.userId} value={m.userId}>{m.user.displayName}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Validator</label>
          <select
            key={task.id + '-validator'}
            defaultValue={task.validator?.id ?? ''}
            onChange={(e) => save({ validatorId: e.target.value || null })}
            className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 bg-white focus:outline-none focus:border-blue-400"
          >
            <option value="">— Unassigned —</option>
            {orgMembers.map((m) => <option key={m.userId} value={m.userId}>{m.user.displayName}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Watchers</label>
          <UserChips users={task.watchers} orgMembers={orgMembers} onAdd={handleWatcherAdd} onRemove={handleWatcherRemove} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Advisors</label>
          <UserChips users={task.advisors} orgMembers={orgMembers} onAdd={handleAdvisorAdd} onRemove={handleAdvisorRemove} />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Reporter</label>
          <p className="text-sm text-gray-700 px-2 py-1.5">{task.reporter.displayName}</p>
        </div>

        {/* History */}
        <div>
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 flex items-center gap-1"
          >
            <span>{showHistory ? '▾' : '▸'}</span> History
          </button>
          {showHistory && (
            <div className="mt-2">
              {history === null ? (
                <p className="text-xs text-gray-400">Loading…</p>
              ) : (
                <HistoryFeed history={history} />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-gray-200 shrink-0">
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-red-600 flex-1">Delete this task?</span>
            <button onClick={() => setConfirmDelete(false)} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
            <button onClick={handleDelete} disabled={isPending} className="text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50">Confirm</button>
          </div>
        ) : (
          <button onClick={handleDelete} className="text-xs text-red-500 hover:text-red-700 transition-colors">Delete task</button>
        )}
      </div>
    </aside>
  )
}
