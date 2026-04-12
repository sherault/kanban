'use client'

import { useState, useEffect, useCallback, useTransition, useRef } from 'react'
import type { TaskDto } from '@kanban/shared'
import { restoreTaskAction } from '@/actions/tasks'

const PAGE_SIZE = 20

interface Props {
  projectId: string
  onRestored: (task: TaskDto) => void
  onTaskClick: (task: TaskDto) => void
}

export function ArchivePanel({ projectId, onRestored, onTaskClick }: Props) {
  const [open, setOpen] = useState(false)
  const [panelHeight, setPanelHeight] = useState(320)
  const [search, setSearch] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [page, setPage] = useState(1)
  const [data, setData] = useState<{ tasks: TaskDto[]; total: number } | null>(null)
  const [loading, setLoading] = useState(false)
  const [isPending, startTransition] = useTransition()
  const dragStartY = useRef<number>(0)
  const dragStartHeight = useRef<number>(0)

  const onResizeMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    dragStartY.current = e.clientY
    dragStartHeight.current = panelHeight

    function onMouseMove(ev: MouseEvent) {
      // Dragging up increases height (panel grows upward)
      const delta = dragStartY.current - ev.clientY
      setPanelHeight(Math.min(600, Math.max(120, dragStartHeight.current + delta)))
    }
    function onMouseUp() {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [panelHeight])

  const load = useCallback(async (s: string, p: number, from: string, to: string) => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (s) params.set('search', s)
      params.set('page', String(p))
      if (from) params.set('dateFrom', from)
      if (to) params.set('dateTo', to)
      const res = await fetch(`/api/archived-tasks/${projectId}?${params}`)
      if (res.ok) setData(await res.json() as { tasks: TaskDto[]; total: number })
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    if (open) void load(search, page, dateFrom, dateTo)
  }, [open, page, load])

  // Debounce text search
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => { setPage(1); void load(search, 1, dateFrom, dateTo) }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  // Immediate reload on date change
  useEffect(() => {
    if (!open) return
    setPage(1)
    void load(search, 1, dateFrom, dateTo)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo])

  function handleRestore(taskId: string) {
    startTransition(async () => {
      const result = await restoreTaskAction(projectId, taskId)
      if (result.task) {
        onRestored(result.task)
        void load(search, page, dateFrom, dateTo)
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
        <div className="border-t border-gray-100 flex flex-col relative" style={{ height: panelHeight }}>
          {/* Drag handle */}
          <div
            onMouseDown={onResizeMouseDown}
            className="absolute top-0 left-0 right-0 h-1 cursor-row-resize hover:bg-blue-200 transition-colors z-10"
          />
          {/* Filters */}
          <div className="px-6 py-3 border-b border-gray-100 flex flex-col gap-2">
            <input
              type="search"
              placeholder="Search title, description, tags, team members…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 shrink-0">Archived</span>
              <input
                type="date"
                value={dateFrom}
                onChange={e => setDateFrom(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 text-gray-600"
              />
              <span className="text-xs text-gray-400">→</span>
              <input
                type="date"
                value={dateTo}
                onChange={e => setDateTo(e.target.value)}
                className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 text-gray-600"
              />
              {(dateFrom || dateTo) && (
                <button
                  onClick={() => { setDateFrom(''); setDateTo('') }}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {loading && <p className="text-xs text-gray-400 px-6 py-4">Loading...</p>}
            {!loading && data?.tasks.length === 0 && (
              <p className="text-xs text-gray-400 px-6 py-4">No archived tasks{search ? ' matching your search' : ''}.</p>
            )}
            {!loading && data?.tasks.map(task => (
              <div
                key={task.id}
                onClick={() => onTaskClick(task)}
                className="flex items-center gap-3 px-6 py-2.5 hover:bg-gray-50 group cursor-pointer"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{task.title}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-0.5">
                    {task.doer && <span className="text-xs text-gray-400">{task.doer.displayName}</span>}
                    {task.validator && <span className="text-xs text-gray-400 italic">{task.validator.displayName}</span>}
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
                  onClick={(e) => { e.stopPropagation(); handleRestore(task.id) }}
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
