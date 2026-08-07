import { useEffect, useRef } from "react";
import { format } from "date-fns";
import type { WikiHistoryDto } from "@kanban/shared";

export function WikiHistoryVersionList({
  versions,
  isLoading,
  hasMore,
  error,
  onLoadMore,
  onSelectVersion,
}: {
  versions: WikiHistoryDto[];
  isLoading: boolean;
  hasMore: boolean;
  error: string | null;
  onLoadMore: () => void;
  onSelectVersion: (version: WikiHistoryDto) => void;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || isLoading) return;

    const observer = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) onLoadMore();
    });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, isLoading, onLoadMore]);

  return (
    <div className="flex-1 overflow-y-auto">
      {error && (
        <div className="p-4 text-sm text-red-600 bg-red-50 border-b border-red-100">
          {error}
        </div>
      )}

      {versions.map((version) => (
        <button
          key={version.id}
          onClick={() => onSelectVersion(version)}
          className="w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="text-xs font-mono text-gray-600">
              {format(new Date(version.createdAt), "MMM d, yyyy HH:mm")}
            </span>
            {version.source === "mcp" && (
              <span className="text-[9px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded">
                MCP
              </span>
            )}
          </div>
          <span className="text-xs font-medium text-gray-500 truncate">
            {version.changedByName || "Unknown author"}
          </span>
        </button>
      ))}

      {!isLoading && !hasMore && !error && versions.length === 0 && (
        <div className="p-8 text-center text-gray-400 text-sm italic">
          No version history found.
        </div>
      )}

      {isLoading && (
        <div className="p-6 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {hasMore && <div ref={sentinelRef} className="h-px" />}
    </div>
  );
}
