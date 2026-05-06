export function BoardErrorBanner({
  error,
  onClear,
}: {
  error: string | null;
  onClear: () => void;
}) {
  if (!error) return null;

  return (
    <div className="mx-6 mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md px-3 py-2 flex items-center justify-between shrink-0">
      <span>{error}</span>
      <button
        onClick={onClear}
        className="ml-2 text-red-400 hover:text-red-600 text-lg leading-none"
      >
        ×
      </button>
    </div>
  );
}
