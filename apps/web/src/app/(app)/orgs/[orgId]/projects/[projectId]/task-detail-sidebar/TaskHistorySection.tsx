import type { TaskHistoryDto } from "@kanban/shared";
import { HistoryFeed } from "./HistoryFeed";

export function TaskHistorySection({
  showHistory,
  history,
  onToggle,
}: {
  showHistory: boolean;
  history: TaskHistoryDto[] | null;
  onToggle: () => void;
}) {
  return (
    <div className="border-t border-gray-100 pt-5">
      <button
        onClick={onToggle}
        className="text-xs font-semibold text-gray-500 uppercase tracking-wide hover:text-gray-700 flex items-center gap-1"
      >
        <span>{showHistory ? "▾" : "▸"}</span> History
      </button>
      {showHistory && (
        <div className="mt-3">
          {history === null ? (
            <p className="text-xs text-gray-400">Loading history…</p>
          ) : (
            <HistoryFeed history={history} />
          )}
        </div>
      )}
    </div>
  );
}
