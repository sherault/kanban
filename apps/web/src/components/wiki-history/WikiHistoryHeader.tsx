export function WikiHistoryHeader({
  count,
  onClose,
}: {
  count: number;
  onClose: () => void;
}) {
  return (
    <div className="flex-none h-14 border-b border-gray-100 px-4 flex items-center justify-between bg-white">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-bold text-gray-900">History</h2>
        <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">
          {count} loaded
        </span>
      </div>
      <button
        onClick={onClose}
        aria-label="Close history"
        className="p-1.5 hover:bg-gray-100 rounded-full transition-all group"
      >
        <svg
          className="w-5 h-5 text-gray-400 group-hover:text-gray-600"
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
