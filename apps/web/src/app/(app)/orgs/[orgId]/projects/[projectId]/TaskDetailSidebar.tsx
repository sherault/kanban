'use client'

import { useState, useTransition, useEffect, useRef, useCallback } from 'react'
import type { TaskDto, MembershipDto, TaskHistoryDto, Column } from '@kanban/shared'
import { ColorPicker } from './ColorPicker'
import { DescriptionEditor } from './DescriptionEditor'
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
  revision: number
  objectives: string[]
  allTags: string[]
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

// ── Conflict-aware field hook ─────────────────────────────────────────────────

interface ConflictInfo { ours: string; theirs: string }

function useConflictField(externalValue: string) {
  const [value, setValue] = useState(externalValue)
  const [isFocused, setIsFocused] = useState(false)
  const [conflict, setConflict] = useState<ConflictInfo | null>(null)
  const valueAtFocusRef = useRef(externalValue)
  const pendingWsRef = useRef<string | null>(null)

  useEffect(() => {
    if (!isFocused) {
      setValue(externalValue)
    } else {
      pendingWsRef.current = externalValue
    }
  }, [externalValue]) // eslint-disable-line react-hooks/exhaustive-deps

  const onFocus = useCallback(() => {
    setIsFocused(true)
    valueAtFocusRef.current = value
    pendingWsRef.current = null
  }, [value])

  const onBlur = useCallback(() => {
    setIsFocused(false)
    const pendingWs = pendingWsRef.current
    if (pendingWs !== null && pendingWs !== valueAtFocusRef.current) {
      // WS changed the value while we had focus
      if (value !== valueAtFocusRef.current) {
        // We also changed it → real conflict
        setConflict({ ours: value, theirs: pendingWs })
      } else {
        // We didn't change → silently accept WS
        setValue(pendingWs)
      }
    }
    pendingWsRef.current = null
  }, [value])

  const resolveConflict = useCallback((choice: 'ours' | 'theirs') => {
    if (conflict && choice === 'theirs') setValue(conflict.theirs)
    setConflict(null)
  }, [conflict])

  return { value, setValue, onFocus, onBlur, conflict, resolveConflict }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ConflictModal({ field, conflict, onResolve }: {
  field: string
  conflict: ConflictInfo
  onResolve: (choice: 'ours' | 'theirs') => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-96 space-y-4">
        <h3 className="text-sm font-semibold text-gray-900">Conflict on <span className="italic">{field}</span></h3>
        <p className="text-xs text-gray-500">This field was updated by someone else while you were editing it.</p>
        <div className="space-y-2">
          <div className="rounded border border-gray-200 p-3">
            <p className="text-xs font-medium text-gray-400 mb-1">Your version</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{conflict.ours || <em className="text-gray-400">empty</em>}</p>
          </div>
          <div className="rounded border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs font-medium text-amber-600 mb-1">Their version</p>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{conflict.theirs || <em className="text-gray-400">empty</em>}</p>
          </div>
        </div>
        <div className="flex gap-2 justify-end">
          <button
            onClick={() => onResolve('ours')}
            className="text-xs px-3 py-1.5 rounded border border-gray-200 hover:border-gray-300 text-gray-700"
          >
            Keep mine
          </button>
          <button
            onClick={() => onResolve('theirs')}
            className="text-xs px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700"
          >
            Accept theirs
          </button>
        </div>
      </div>
    </div>
  )
}

function TagInput({ tags, allTags, onAdd, onRemove }: { tags: string[]; allTags: string[]; onAdd: (t: string) => void; onRemove: (t: string) => void }) {
  const [input, setInput] = useState('')
  const listId = useRef(`tag-suggestions-${Math.random().toString(36).slice(2)}`).current
  const suggestions = allTags.filter((t) => !tags.includes(t))

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
        list={listId}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder={tags.length === 0 ? 'Add tag, press Enter…' : ''}
        className="flex-1 min-w-[80px] text-xs outline-none bg-transparent"
      />
      <datalist id={listId}>
        {suggestions.map((t) => <option key={t} value={t} />)}
      </datalist>
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
  revision,
  objectives,
  allTags,
  onClose,
  onUpdated,
  onDeleted,
}: Props) {
  const [isPending, startTransition] = useTransition()
  const [saveError, setSaveError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [history, setHistory] = useState<TaskHistoryDto[] | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [sidebarWidth, setSidebarWidth] = useState(384) // w-96 default

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarWidth
    function onMove(ev: MouseEvent) {
      const delta = startX - ev.clientX
      setSidebarWidth(Math.min(800, Math.max(280, startW + delta)))
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }, [sidebarWidth])

  // Controlled conflict-aware fields
  const titleField = useConflictField(task.title)
  const descField = useConflictField(task.description ?? '')
  const objField = useConflictField(task.objective ?? '')
  const subjectField = useConflictField(task.globalSubject ?? '')

  // Keep fields in sync when task prop changes (WS updates)
  // useConflictField's internal effect handles this via externalValue changes,
  // but we need stable references — pass updated values when task changes
  const prevTaskRef = useRef(task)
  useEffect(() => {
    const prev = prevTaskRef.current
    prevTaskRef.current = task
    // Only propagate if the server value actually changed (not just revision bump)
    if (task.title !== prev.title) titleField.setValue(task.title)  // handled by hook, but explicit
    // The hook's own useEffect fires on externalValue change — this is a no-op here
    // because externalValue is stable between renders unless task.xxx changed.
    // The hook's effect IS the update path; this block is intentionally left minimal.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task])

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
    if (!showHistory) return
    void getTaskHistoryAction(projectId, task.id).then((res) => {
      if (res.history) setHistory(res.history)
    })
  }, [showHistory, revision, projectId, task.id])

  // First active conflict to show in modal
  const activeConflict =
    titleField.conflict ? { field: 'Title', info: titleField.conflict, resolve: titleField.resolveConflict } :
    descField.conflict ? { field: 'Description', info: descField.conflict, resolve: descField.resolveConflict } :
    objField.conflict ? { field: 'Objective', info: objField.conflict, resolve: objField.resolveConflict } :
    subjectField.conflict ? { field: 'Global subject', info: subjectField.conflict, resolve: subjectField.resolveConflict } :
    null

  return (
    <>
      {activeConflict && (
        <ConflictModal
          field={activeConflict.field}
          conflict={activeConflict.info}
          onResolve={activeConflict.resolve}
        />
      )}

      <aside data-sidebar="true" style={{ width: sidebarWidth }} className="border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden shrink-0 relative">
        {/* Resize handle */}
        <div
          onMouseDown={onResizeMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 transition-colors z-10 group"
          title="Drag to resize"
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors" />
        </div>

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
              value={titleField.value}
              onChange={(e) => titleField.setValue(e.target.value)}
              onFocus={titleField.onFocus}
              onBlur={(e) => {
                titleField.onBlur()
                const v = e.target.value.trim()
                if (v && v !== task.title) save({ title: v })
              }}
              className="w-full text-sm font-medium text-gray-900 border border-transparent rounded px-2 py-1.5 hover:border-gray-200 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
            />
          </div>

          {/* Background color */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Color</label>
            <ColorPicker
              value={task.backgroundColor ?? null}
              onChange={(color) => {
                if (color !== task.backgroundColor) save({ backgroundColor: color })
              }}
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Description</label>
            <DescriptionEditor
              value={descField.value}
              onChange={descField.setValue}
              onFocus={descField.onFocus}
              onBlur={(v) => {
                descField.onBlur()
                const val = v || null
                if (val !== task.description) save({ description: val })
              }}
            />
          </div>

          {/* Objective */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Objective</label>
            <input
              list={`obj-list-${task.id}`}
              value={objField.value}
              onChange={(e) => objField.setValue(e.target.value)}
              onFocus={objField.onFocus}
              onBlur={(e) => {
                objField.onBlur()
                const v = e.target.value || null
                if (v !== task.objective) save({ objective: v })
              }}
              placeholder="Add an objective…"
              className="w-full text-sm text-gray-700 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
            <datalist id={`obj-list-${task.id}`}>
              {objectives.filter((o) => o !== task.objective).map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>

          {/* Global subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Global subject</label>
            <input
              value={subjectField.value}
              onChange={(e) => subjectField.setValue(e.target.value)}
              onFocus={subjectField.onFocus}
              onBlur={(e) => {
                subjectField.onBlur()
                const v = e.target.value || null
                if (v !== task.globalSubject) save({ globalSubject: v })
              }}
              placeholder="Epic or global subject…"
              className="w-full text-sm text-gray-700 border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Tags</label>
            <TagInput tags={task.tags} allTags={allTags} onAdd={handleTagAdd} onRemove={handleTagRemove} />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Start</label>
              <input
                key={task.id + '-start-' + task.startDate}
                type="date"
                defaultValue={task.startDate}
                onBlur={(e) => { if (e.target.value && e.target.value !== task.startDate) save({ startDate: e.target.value }) }}
                className="w-full text-sm border border-gray-200 rounded px-2 py-1.5 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">End</label>
              <input
                key={task.id + '-end-' + task.endDate}
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
              key={task.id + '-doer-' + task.doer?.id}
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
              key={task.id + '-validator-' + task.validator?.id}
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
    </>
  )
}
