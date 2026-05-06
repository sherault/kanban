import type { TaskDto } from "@kanban/shared";
import type { MouseEvent } from "react";
import { COLUMN_BADGE } from "./constants";

export function TaskDetailHeader({
  task,
  isExpanded,
  isPending,
  showCloseAll,
  onActivate,
  onOpenAsComparison,
  onResizeMouseDown,
  onCloseAll,
  onFold,
  onClose,
}: {
  task: TaskDto;
  isExpanded: boolean;
  isPending: boolean;
  showCloseAll?: boolean;
  onActivate: () => void;
  onOpenAsComparison?: () => void;
  onResizeMouseDown: (event: MouseEvent) => void;
  onCloseAll?: () => void;
  onFold?: () => void;
  onClose: () => void;
}) {
  return (
    <>
      {!isExpanded && (
        <div
          onClick={onActivate}
          className="group absolute inset-0 z-[100] bg-gray-900/5 cursor-pointer hover:bg-gray-900/10 transition-colors flex items-start"
        >
          <div
            className="w-12 h-full flex items-center justify-center bg-white border-r border-gray-200"
            style={{ writingMode: "vertical-rl", transform: "rotate(180deg)" }}
          >
            <span className="text-sm font-bold text-gray-400 whitespace-nowrap overflow-hidden text-ellipsis max-h-[80%] uppercase tracking-widest px-2">
              {task.title || "Untitled Task"}
            </span>
          </div>
          {onOpenAsComparison && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onOpenAsComparison();
              }}
              className="absolute top-4 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 p-1 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
              title="Open as comparison panel"
            >
              <CompareIcon dashed={false} />
            </button>
          )}
        </div>
      )}

      {isExpanded && (
        <div
          onMouseDown={onResizeMouseDown}
          className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-400 active:bg-blue-500 transition-colors z-10 group"
          title="Drag to resize"
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors" />
        </div>
      )}

      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 shrink-0">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${COLUMN_BADGE[task.column] ?? "bg-gray-100 text-gray-700"}`}
          >
            {task.column || "..."}
          </span>
          {showCloseAll && onCloseAll && (
            <button
              onClick={onCloseAll}
              className="text-[10px] font-bold tracking-wider uppercase text-red-500 hover:text-red-700 transition-colors"
              title="Close all open panels"
            >
              Close All
            </button>
          )}
        </div>
        <div className="flex items-center gap-3">
          {isPending && <span className="text-xs text-gray-400">Saving…</span>}
          {onFold && (
            <button
              onClick={onFold}
              className="text-gray-400 hover:text-blue-600 transition-colors"
              title="Close comparison view"
            >
              <CompareIcon dashed />
            </button>
          )}
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
      </div>
    </>
  );
}

function CompareIcon({ dashed }: { dashed: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <rect
        x="1"
        y="2"
        width="5"
        height="12"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <rect
        x={dashed ? "10" : "8"}
        y={dashed ? "2" : "1"}
        width={dashed ? "5" : "5"}
        height={dashed ? "12" : "12"}
        rx="1"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeDasharray={dashed ? "2 1.5" : undefined}
      />
    </svg>
  );
}
