import * as DndKit from "@dnd-kit/core";
import { ROOT_DROPPABLE_ID } from "./constants";

export function RootDroppable() {
  const { setNodeRef, isOver } = DndKit.useDroppable({
    id: ROOT_DROPPABLE_ID,
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex-none h-8 mx-3 mt-2 rounded border-2 border-dashed flex items-center justify-center text-[10px] font-medium transition-all ${
        isOver
          ? "border-blue-400 bg-blue-50 text-blue-600 opacity-100"
          : "border-gray-100 text-gray-300 opacity-0 hover:opacity-50"
      }`}
    >
      Drop here to move to Root
    </div>
  );
}
