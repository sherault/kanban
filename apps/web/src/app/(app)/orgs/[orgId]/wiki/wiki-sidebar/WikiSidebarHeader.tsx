interface WikiSidebarHeaderProps {
  onRefresh: () => void;
}

export function WikiSidebarHeader({ onRefresh }: WikiSidebarHeaderProps) {
  return (
    <div className="flex-none h-12 px-4 flex items-center justify-between border-b border-gray-100 bg-gray-50/50">
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
        Knowledge Base
      </span>
      <button
        onClick={onRefresh}
        className="p-1 hover:bg-gray-200 rounded text-gray-400 transition-colors"
        title="Refresh"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
          />
        </svg>
      </button>
    </div>
  );
}
