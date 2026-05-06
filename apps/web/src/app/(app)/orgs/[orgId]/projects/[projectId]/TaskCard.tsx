"use client";

import { useState, useEffect } from "react";
import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import type { TaskDto } from "@kanban/shared";
import { isDateOverdue, parseTaskDate } from "./task-card/date";
import { TaskCardContent } from "./task-card/TaskCardContent";
import { TaskCardControls } from "./task-card/TaskCardControls";

interface Props {
  task: TaskDto;
  onClick: () => void;
  onOpenAsComparison?: () => void;
  overlay?: boolean;
  selectable?: boolean;
  selected?: boolean;
  onSelectChange?: (selected: boolean) => void;
  onTagClick?: (tag: string) => void;
  onObjectiveClick?: (objective: string) => void;
  onDoerClick?: (userId: string) => void;
}

export function TaskCard({
  task,
  onClick,
  onOpenAsComparison,
  overlay = false,
  selectable = false,
  selected = false,
  onSelectChange,
  onTagClick,
  onObjectiveClick,
  onDoerClick,
}: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } =
    useDraggable({
      id: task.id,
    });

  const style = {
    transform: CSS.Translate.toString(transform),
    ...(task.backgroundColor ? { backgroundColor: task.backgroundColor } : {}),
  };

  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsMounted(true), 0);
    return () => clearTimeout(timer);
  }, []);

  const endDate = parseTaskDate(task.endDate);
  const isOverdue = isMounted && isDateOverdue(endDate);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`group relative bg-white rounded-lg border p-3 cursor-pointer select-none transition-shadow ${
        selected ? "border-blue-400 ring-1 ring-blue-200" : "border-gray-200"
      } ${
        isDragging
          ? "opacity-40 shadow-lg"
          : "hover:shadow-sm hover:border-gray-300"
      } ${overlay ? "shadow-xl rotate-2 opacity-90" : ""}`}
    >
      <TaskCardControls
        overlay={overlay}
        selectable={selectable}
        selected={selected}
        onOpenAsComparison={onOpenAsComparison}
        onSelectChange={onSelectChange}
      />
      <TaskCardContent
        date={endDate}
        isMounted={isMounted}
        isOverdue={isOverdue}
        task={task}
        onDoerClick={onDoerClick}
        onObjectiveClick={onObjectiveClick}
        onTagClick={onTagClick}
      />
    </div>
  );
}
