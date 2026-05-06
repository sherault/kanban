export function ArchivePagination({
  page,
  totalPages,
  onPageChange,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-6 py-2 border-t border-gray-100">
      <button
        onClick={() => onPageChange(Math.max(1, page - 1))}
        disabled={page === 1}
        className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-700"
      >
        Prev
      </button>
      <span className="text-xs text-gray-400">
        Page {page} / {totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, page + 1))}
        disabled={page === totalPages}
        className="text-xs text-gray-500 disabled:opacity-30 hover:text-gray-700"
      >
        Next
      </button>
    </div>
  );
}
