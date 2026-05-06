export function BoardFilters({
  activeTag,
  activeObjective,
  activeDoerName,
  activeDoerId,
  onClearTag,
  onClearObjective,
  onClearDoer,
  onClearAll,
}: {
  activeTag: string | null;
  activeObjective: string | null;
  activeDoerName: string | null;
  activeDoerId: string | null;
  onClearTag: () => void;
  onClearObjective: () => void;
  onClearDoer: () => void;
  onClearAll: () => void;
}) {
  if (!activeTag && !activeObjective && !activeDoerId) return null;

  return (
    <div className="mx-6 mt-4 flex items-center gap-2 shrink-0 flex-wrap">
      <span className="text-xs text-gray-400">Filters:</span>
      {activeTag && (
        <FilterChip tone="blue" onClear={onClearTag}>
          #{activeTag}
        </FilterChip>
      )}
      {activeObjective && (
        <FilterChip tone="purple" onClear={onClearObjective}>
          {activeObjective}
        </FilterChip>
      )}
      {activeDoerName && (
        <FilterChip tone="green" onClear={onClearDoer}>
          {activeDoerName}
        </FilterChip>
      )}
      {[activeTag, activeObjective, activeDoerId].filter(Boolean).length >
        1 && (
        <button
          onClick={onClearAll}
          className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2 ml-1"
        >
          Clear all
        </button>
      )}
    </div>
  );
}

function FilterChip({
  tone,
  onClear,
  children,
}: {
  tone: "blue" | "purple" | "green";
  onClear: () => void;
  children: ReactNode;
}) {
  const colors = {
    blue: "bg-blue-100 text-blue-700 text-blue-500 hover:text-blue-800",
    purple:
      "bg-purple-100 text-purple-700 text-purple-500 hover:text-purple-800",
    green: "bg-green-100 text-green-700 text-green-500 hover:text-green-800",
  }[tone];
  const [base, text, button, hover] = colors.split(" ");
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs ${base} ${text} font-medium px-2 py-0.5 rounded-full`}
    >
      {children}
      <button
        onClick={onClear}
        className={`${button} ${hover} leading-none ml-0.5`}
      >
        ×
      </button>
    </span>
  );
}
import type { ReactNode } from "react";
