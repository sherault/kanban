import { createPortal } from "react-dom";
import type { TaskDto, WikiPageSummaryDto } from "@kanban/shared";

type MentionItem = TaskDto | WikiPageSummaryDto;

export function MentionList({
  mentionSearch,
  mentionType,
  mentionIndex,
  mentionCoords,
  activeResults,
  onSelect,
}: {
  mentionSearch: string | null;
  mentionType: "task" | "wiki";
  mentionIndex: number;
  mentionCoords: { top: number; left: number };
  activeResults: MentionItem[];
  onSelect: (item: MentionItem) => void;
}) {
  if (mentionSearch === null || activeResults.length === 0) return null;

  return createPortal(
    <div
      className="fixed z-[9999] bg-white border border-gray-200 rounded-lg shadow-2xl overflow-hidden w-72 max-h-60 flex flex-col animate-in fade-in slide-in-from-bottom-2 duration-200"
      style={{ left: mentionCoords.left, top: mentionCoords.top }}
    >
      <div className="bg-gray-50 px-3 py-1.5 border-b border-gray-200 flex items-center justify-between">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
          {mentionType === "task" ? "Mention Task" : "Mention Wiki Page"}
        </span>
      </div>
      <div className="overflow-y-auto py-1">
        {activeResults.map((item, i) => (
          <button
            key={item.id}
            onMouseDown={(e) => {
              e.preventDefault();
              onSelect(item);
            }}
            className={`w-full text-left px-3 py-2 flex items-start gap-2.5 transition-colors ${i === mentionIndex ? "bg-blue-50" : "hover:bg-gray-50"}`}
          >
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-900 truncate">
                {item.title}
              </p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-[10px] text-gray-400 font-mono">
                  {mentionType === "task" ? "#" : "w/"}
                  {mentionType === "task"
                    ? item.id.slice(0, 6)
                    : "slug" in item
                      ? item.slug
                      : ""}
                </span>
                {mentionType === "task" &&
                  "projectName" in item &&
                  item.projectName && (
                    <span className="text-[10px] px-1 bg-gray-100 text-gray-500 rounded uppercase">
                      {item.projectName}
                    </span>
                  )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
