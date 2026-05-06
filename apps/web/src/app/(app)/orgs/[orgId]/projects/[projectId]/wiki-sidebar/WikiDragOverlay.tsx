import * as DndKit from "@dnd-kit/core";
import type { WikiPageSummaryDto } from "@kanban/shared";

interface WikiDragOverlayProps {
  activeId: string | null;
  pages: WikiPageSummaryDto[];
}

export function WikiDragOverlay({ activeId, pages }: WikiDragOverlayProps) {
  return (
    <DndKit.DragOverlay>
      {activeId ? (
        <div className="bg-white shadow-xl border border-blue-100 rounded-md px-3 py-2 text-sm text-gray-600 opacity-90 cursor-grabbing border-l-4 border-l-blue-500">
          {pages.find((page) => page.id === activeId)?.title}
        </div>
      ) : null}
    </DndKit.DragOverlay>
  );
}
