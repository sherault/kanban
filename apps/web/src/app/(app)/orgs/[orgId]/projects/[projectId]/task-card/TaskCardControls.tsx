interface TaskCardControlsProps {
  overlay: boolean;
  selectable: boolean;
  selected: boolean;
  onOpenAsComparison?: () => void;
  onSelectChange?: (selected: boolean) => void;
}

export function TaskCardControls({
  overlay,
  selectable,
  selected,
  onOpenAsComparison,
  onSelectChange,
}: TaskCardControlsProps) {
  if ((overlay || !onOpenAsComparison) && !selectable) return null;

  return (
    <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
      {onOpenAsComparison && !overlay && (
        <button
          onClick={(event) => {
            event.stopPropagation();
            onOpenAsComparison();
          }}
          className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-all"
          title="Open as comparison panel"
        >
          <svg
            width="13"
            height="13"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <rect
              x="1"
              y="1"
              width="5"
              height="12"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.4"
            />
            <rect
              x="8"
              y="1"
              width="5"
              height="12"
              rx="1"
              stroke="currentColor"
              strokeWidth="1.4"
            />
          </svg>
        </button>
      )}
      {selectable && (
        <div
          className="flex items-center justify-center p-0.5"
          onClick={(event) => {
            event.stopPropagation();
            onSelectChange?.(!selected);
          }}
        >
          <input
            type="checkbox"
            checked={selected}
            onChange={(event) => {
              event.stopPropagation();
              onSelectChange?.(event.target.checked);
            }}
            onClick={(event) => event.stopPropagation()}
            className="w-3.5 h-3.5 accent-blue-500 cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}
