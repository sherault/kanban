export function WikiHistoryHeader({
  pageId,
  onClose,
}: {
  pageId: string;
  onClose: () => void;
}) {
  return (
    <div className="flex-none h-16 border-b border-gray-200 px-6 flex items-center justify-between bg-white shadow-sm">
      <div className="flex flex-col">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-gray-900">Version History</h2>
          <span className="px-2 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-500 rounded border border-gray-200 uppercase tracking-tighter">
            ID: {pageId}
          </span>
        </div>
        <p className="text-xs text-gray-500 mt-0.5">
          Compare edits and recover previous versions
        </p>
      </div>
      <button
        onClick={onClose}
        className="p-2 hover:bg-gray-100 rounded-full transition-all group"
      >
        <svg
          className="w-6 h-6 text-gray-400 group-hover:text-gray-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  );
}
