import type { MouseEvent } from "react";

export function ArchiveResizeHandle({
  onMouseDown,
}: {
  onMouseDown: (event: MouseEvent) => void;
}) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute top-0 left-0 right-0 h-2 cursor-row-resize z-20 flex items-center justify-center group"
      title="Drag to resize"
    >
      <div className="w-10 h-1 rounded-full bg-gray-300 group-hover:bg-blue-400 transition-colors" />
    </div>
  );
}
