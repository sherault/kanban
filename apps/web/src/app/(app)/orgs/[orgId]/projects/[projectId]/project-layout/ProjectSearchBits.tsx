export function ResultIcon({
  tone,
  path,
}: {
  tone: "blue" | "emerald";
  path: string;
}) {
  const hover =
    tone === "blue" ? "group-hover:bg-blue-100" : "group-hover:bg-emerald-100";
  const iconHover =
    tone === "blue"
      ? "group-hover:text-blue-600"
      : "group-hover:text-emerald-600";
  return (
    <div
      className={`mt-1 p-1.5 bg-gray-100 rounded ${hover} transition-colors`}
    >
      <svg
        className={`w-4 h-4 text-gray-500 ${iconHover}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d={path}
        />
      </svg>
    </div>
  );
}

export function NoResults() {
  return (
    <div className="py-12 flex flex-col items-center gap-2">
      <div className="p-3 bg-gray-50 rounded-full">
        <svg
          className="w-6 h-6 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <div className="text-center">
        <p className="text-sm font-medium text-gray-900">No results found</p>
        <p className="text-xs text-gray-500 mt-1">
          Try searching for a different title or keyword.
        </p>
      </div>
    </div>
  );
}

export function CloseIcon() {
  return (
    <svg
      className="w-4 h-4"
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
  );
}
