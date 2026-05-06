import { format } from "date-fns";
import type { WikiHistoryDto } from "@kanban/shared";

export function WikiHistoryVersionList({
  history,
  isLoading,
  selectedVersionIndex,
  onSelectVersion,
}: {
  history: WikiHistoryDto[];
  isLoading: boolean;
  selectedVersionIndex: number;
  onSelectVersion: (index: number) => void;
}) {
  return (
    <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50/20">
      <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/50">
        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Revisions
        </span>
        <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">
          {history.length} total
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="p-12 flex flex-col items-center justify-center text-gray-400 space-y-3">
            <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm italic">Retrieving history...</span>
          </div>
        ) : history.length === 0 ? (
          <div className="p-12 text-center text-gray-400 text-sm italic">
            No version history found.
          </div>
        ) : (
          history.map((version, idx) => (
            <button
              key={version.id}
              onClick={() => onSelectVersion(idx)}
              className={`w-full text-left p-4 border-b border-gray-100 transition-all hover:bg-white relative group ${
                selectedVersionIndex === idx
                  ? "bg-white border-l-4 border-l-blue-500 shadow-sm z-10"
                  : "opacity-70 hover:opacity-100"
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    idx === 0
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-600"
                  }`}
                >
                  {idx === 0 ? "Current" : `v${history.length - idx}`}
                </span>
                <span className="text-[10px] text-gray-400 font-mono">
                  {format(new Date(version.createdAt), "MMM d, HH:mm:ss")}
                </span>
              </div>
              <div className="text-sm font-bold text-gray-800 line-clamp-1 mb-1">
                {version.title || "Untitled"}
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[8px] text-white font-bold uppercase">
                  {(version.changedByName || "U")[0]}
                </div>
                <span className="text-xs font-medium text-gray-500 truncate">
                  {version.changedByName || "Unknown Author"}
                </span>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}
