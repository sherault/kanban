import type { KeyboardEvent, RefObject } from "react";

export function SearchField({
  inputRef,
  type,
  search,
  onSearchChange,
  onClose,
}: {
  inputRef: RefObject<HTMLInputElement | null>;
  type: "wiki" | "task";
  search: string;
  onSearchChange: (value: string) => void;
  onClose: () => void;
}) {
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") onClose();
  };

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        onKeyDown={onKeyDown}
        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
        placeholder={
          type === "wiki" ? "Search wiki pages..." : "Search tasks..."
        }
      />
      <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
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
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>
    </div>
  );
}
