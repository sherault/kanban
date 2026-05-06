"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { MouseEvent } from "react";
import type { TaskDto } from "@kanban/shared";
import { deleteTaskAction, restoreTaskAction } from "@/actions/tasks";
import { ArchiveDeleteModal } from "./archive-panel/ArchiveDeleteModal";
import { ArchiveFilters } from "./archive-panel/ArchiveFilters";
import { ArchivePagination } from "./archive-panel/ArchivePagination";
import { ArchiveTaskList } from "./archive-panel/ArchiveTaskList";

const PAGE_SIZE = 20;

interface Props {
  projectId: string;
  onRestored: (task: TaskDto) => void;
  onTaskClick: (task: TaskDto) => void;
  refreshTrigger?: number;
}

export function ArchivePanel(props: Props) {
  const { projectId, onRestored, onTaskClick, refreshTrigger } = props;
  const [open, setOpen] = useState(false);
  const [panelHeight, setPanelHeight] = useState(320);
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<{ tasks: TaskDto[]; total: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const dragStartY = useRef(0);
  const dragStartHeight = useRef(0);

  const onResizeMouseDown = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      dragStartY.current = event.clientY;
      dragStartHeight.current = panelHeight;
      function onMouseMove(ev: globalThis.MouseEvent) {
        const delta = dragStartY.current - ev.clientY;
        setPanelHeight(
          Math.min(600, Math.max(120, dragStartHeight.current + delta)),
        );
      }
      function onMouseUp() {
        document.removeEventListener("mousemove", onMouseMove);
        document.removeEventListener("mouseup", onMouseUp);
      }
      document.addEventListener("mousemove", onMouseMove);
      document.addEventListener("mouseup", onMouseUp);
    },
    [panelHeight],
  );

  const load = useCallback(
    async (s: string, p: number, from: string, to: string) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        if (s) params.set("search", s);
        params.set("page", String(p));
        if (from) params.set("dateFrom", from);
        if (to) params.set("dateTo", to);
        const res = await fetch(`/api/archived-tasks/${projectId}?${params}`, {
          cache: "no-store",
        });
        if (res.ok)
          setData((await res.json()) as { tasks: TaskDto[]; total: number });
      } finally {
        setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    if (open) void load(search, page, dateFrom, dateTo);
  }, [open, page, load, refreshTrigger]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => {
      setPage(1);
      void load(search, 1, dateFrom, dateTo);
    }, 300);
    return () => clearTimeout(timer);
  }, [search, open, dateFrom, dateTo, load]);

  useEffect(() => {
    if (!open) return;
    setPage(1);
    void load(search, 1, dateFrom, dateTo);
  }, [dateFrom, dateTo, open, load, search]);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return (
    <div className="bg-white shrink-0 relative">
      {open && <ArchiveResizeHandle onMouseDown={onResizeMouseDown} />}
      <div className="border-t border-gray-200" />
      <button
        onClick={() => setOpen((value) => !value)}
        className="w-full flex items-center justify-between px-6 py-2 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-2">
          <span>{open ? "▾" : "▸"}</span>
          <span className="font-medium">Archives</span>
          {data && (
            <span className="text-xs text-gray-400">({data.total})</span>
          )}
        </span>
      </button>

      {open && (
        <div
          className="border-t border-gray-100 flex flex-col"
          style={{ height: panelHeight }}
        >
          <ArchiveFilters
            search={search}
            dateFrom={dateFrom}
            dateTo={dateTo}
            onSearchChange={setSearch}
            onDateFromChange={setDateFrom}
            onDateToChange={setDateTo}
            onClearDates={() => {
              setDateFrom("");
              setDateTo("");
            }}
          />
          <ArchiveTaskList
            loading={loading}
            tasks={data?.tasks ?? []}
            search={search}
            isPending={isPending}
            onTaskClick={onTaskClick}
            onRestore={handleRestore}
            onDelete={setTaskToDelete}
          />
          <ArchivePagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>
      )}
      {taskToDelete && (
        <ArchiveDeleteModal
          isPending={isPending}
          onCancel={() => setTaskToDelete(null)}
          onConfirm={confirmDelete}
        />
      )}
    </div>
  );

  function handleRestore(taskId: string) {
    startTransition(async () => {
      const result = await restoreTaskAction(projectId, taskId);
      if (result.task) {
        onRestored(result.task);
        removeArchivedTask(taskId);
      }
    });
  }

  function confirmDelete() {
    if (!taskToDelete) return;
    const id = taskToDelete;
    setTaskToDelete(null);
    startTransition(async () => {
      const result = await deleteTaskAction(projectId, id);
      if (!result.error) removeArchivedTask(id);
    });
  }

  function removeArchivedTask(taskId: string) {
    setData((prev) =>
      prev
        ? {
            ...prev,
            tasks: prev.tasks.filter((task) => task.id !== taskId),
            total: Math.max(0, prev.total - 1),
          }
        : null,
    );
  }
}

function ArchiveResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (event: MouseEvent) => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute top-0 left-0 right-0 h-2 cursor-row-resize z-20 flex items-center justify-center group"
      title="Drag to resize"
    >
      <div className="w-10 h-1 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors" />
    </div>
  );
}
