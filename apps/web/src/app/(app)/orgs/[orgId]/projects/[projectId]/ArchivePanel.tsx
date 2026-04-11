'use client'

import { useState, useEffect, useCallback, useTransition } from 'react'
import type { TaskDto } from '@kanban/shared'
import { restoreTaskAction } from '@/actions/tasks'

const PAGE_SIZE = 20

interface Props {
  projectId: string
  onRestored: (task: TaskDto) => void
}

export function ArchivePanel({ projectId, onRestored }: Props) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ tasks: TaskDto[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()

  const load = useCallback(async (s: string, p: number) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (s) params.set('search', s)
      params.set('page', String(p))
      const res = await fetch(`/api/archived-tasks/${projectId}?${params}`)
      if (res.ok) setData(await res.json() as { tasks: TaskDto[]; total: number })
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) void load(search, page)
  }, [open, page, load])

  // Debounce search
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => { setPage(1); void load(search, 1) }, 300)
    return () => clearTimeout(t)
    // Intentionally omitting `open` and `load` — we only want this to fire on search changes
  }, [search])

  function handleRestore(taskId: string) {
    startTransition(async () => {
      const result = await restoreTaskAction(projectId, taskId)
      if (result.task) {
        onRestored(result.task)
        void load(search, page)
      }
    })
  }

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1

  return (
    <div className="border-t border-gray-200 bg-white shrink-0">
      {/* Toggle */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>{open ? '▾' : '▸'}</span>
          <span className="font-medium">Archives</span>
          {data && <span className="text-xs text-gray-400">({data.total})</span>}
        </span>
      </button>

      {open && (
        <div className="border-t border-gray-100 max-h-72 flex flex-col">
          {/* Search */}
          <div className="px-6 py-3 border-b border-gray-100">
            <input
              type="search"
              placeholder="Search archived tasks..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading && <p className="text-xs text-gray-400 px-6 py-4">Loading...</p>}
            {!loading && data?.tasks.length === 0 && (
              <p className="text-xs text-gray-400 px-6 py-4">No archived tasks{search ? ' matching your search' : ''}.</p>
            )}
            {!loading && data?.tasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 px-6 py-2.5 hover:bg-gray-50 group">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {task.doer && <span className="text-xs text-gray-400">{task.doer.displayName}</span>}
                    {task.tags.map(t => (
                      <span key={t} className="text-xs bg-gray-100 text-gray-500 px-1 rounded">{t}</span>
                    ))}
                    {task.archivedAt && (
                      <span className="text-xs text-gray-300">
                        {new Date(task.archivedAt).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleRestore(task.id)}
                  disabled={isPending}
                  className="text-xs text-blue-500 hover:text-blue-700 opacity-0 group-hover:opacity-100 disabled:opacity-50 transition-all shrink-0"
                >
                  Restore
                </button>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-2 border-t border-gray-100">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-700"
              >
                Prev
              </button>
              <span className="text-xs text-gray-400">Page {page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-700"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
