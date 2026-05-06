export function BoardToolbar({
  sidebarTotalWidth,
  selectedDoneCount,
  archiving,
  isConnected,
  onShowImport,
  onArchiveSelected,
}: {
  sidebarTotalWidth: number;
  selectedDoneCount: number;
  archiving: boolean;
  isConnected: boolean;
  onShowImport: () => void;
  onArchiveSelected: () => void;
}) {
  return (
    <div
      className="px-6 pb-3 flex items-center justify-between shrink-0 transition-all duration-300"
      style={{ paddingRight: `${sidebarTotalWidth + 24}px` }}
    >
      <div className="flex items-center gap-2">
        <button
          onClick={onShowImport}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 transition-colors"
        >
          Import CSV
        </button>
        {selectedDoneCount > 0 && (
          <button
            onClick={onArchiveSelected}
            disabled={archiving}
            className="text-xs text-white bg-amber-500 hover:bg-amber-600 disabled:opacity-50 rounded px-2 py-1 transition-colors"
          >
            {archiving
              ? "Archiving..."
              : `Archive ${selectedDoneCount} task${selectedDoneCount > 1 ? "s" : ""}`}
          </button>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-green-400" : "bg-gray-300"}`}
        />
        <span className="text-xs text-gray-400">
          {isConnected ? "Live" : "Connecting…"}
        </span>
      </div>
    </div>
  );
}
