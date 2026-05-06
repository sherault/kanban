export function ArchiveFilters({
  search,
  dateFrom,
  dateTo,
  onSearchChange,
  onDateFromChange,
  onDateToChange,
  onClearDates,
}: {
  search: string;
  dateFrom: string;
  dateTo: string;
  onSearchChange: (value: string) => void;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onClearDates: () => void;
}) {
  return (
    <div className="px-6 py-3 border-b border-gray-100 flex flex-col gap-2">
      <input
        type="search"
        placeholder="Search title, description, tags, team members…"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        className="w-full text-sm border border-gray-200 rounded px-3 py-1.5 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
      />
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 shrink-0">Archived</span>
        <input
          type="date"
          value={dateFrom}
          onChange={(e) => onDateFromChange(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 text-gray-600"
        />
        <span className="text-xs text-gray-400">→</span>
        <input
          type="date"
          value={dateTo}
          onChange={(e) => onDateToChange(e.target.value)}
          className="text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:border-blue-400 text-gray-600"
        />
        {(dateFrom || dateTo) && (
          <button
            onClick={onClearDates}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
}
