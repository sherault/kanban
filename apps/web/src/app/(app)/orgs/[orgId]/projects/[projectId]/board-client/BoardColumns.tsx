import { Column, type TaskDto } from "@kanban/shared";
import { BoardColumn } from "../BoardColumn";
import { BOARD_COLUMNS } from "./constants";

export function BoardColumns({
  tasks,
  sidebarTotalWidth,
  ideasCollapsed,
  activeTag,
  activeObjective,
  activeDoerId,
  selectedDoneIds,
  onToggleIdeas,
  onOpenTask,
  onOpenAsComparison,
  onNewTask,
  onTagClick,
  onObjectiveClick,
  onDoerClick,
  onSelectionChange,
}: {
  tasks: TaskDto[];
  sidebarTotalWidth: number;
  ideasCollapsed: boolean;
  activeTag: string | null;
  activeObjective: string | null;
  activeDoerId: string | null;
  selectedDoneIds: Set<string>;
  onToggleIdeas: () => void;
  onOpenTask: (taskId: string) => void;
  onOpenAsComparison: (taskId: string) => void;
  onNewTask: (column: Column) => void;
  onTagClick: (tag: string) => void;
  onObjectiveClick: (objective: string) => void;
  onDoerClick: (userId: string) => void;
  onSelectionChange: (taskId: string, selected: boolean) => void;
}) {
  return (
    <div
      className="flex gap-4 p-6 overflow-x-auto flex-1 items-start transition-all duration-300"
      style={{ paddingRight: `${sidebarTotalWidth + 24}px` }}
    >
      {BOARD_COLUMNS.map(({ id, label }) => {
        const columnTasks = filterAndSortTasks(tasks, {
          column: id,
          activeTag,
          activeObjective,
          activeDoerId,
        });
        return (
          <BoardColumn
            key={id}
            column={id}
            label={label}
            tasks={columnTasks}
            collapsed={id === Column.IDEAS ? ideasCollapsed : false}
            onToggleCollapse={id === Column.IDEAS ? onToggleIdeas : undefined}
            onTaskClick={onOpenTask}
            onOpenAsComparison={onOpenAsComparison}
            onNewTask={() => onNewTask(id)}
            onTagClick={onTagClick}
            onObjectiveClick={onObjectiveClick}
            onDoerClick={onDoerClick}
            selectable={id === Column.DONE}
            selectedIds={id === Column.DONE ? selectedDoneIds : undefined}
            onSelectionChange={
              id === Column.DONE ? onSelectionChange : undefined
            }
          />
        );
      })}
    </div>
  );
}

function filterAndSortTasks(
  tasks: TaskDto[],
  filters: {
    column: Column;
    activeTag: string | null;
    activeObjective: string | null;
    activeDoerId: string | null;
  },
) {
  return tasks
    .filter(
      (task) =>
        task.column === filters.column &&
        (!filters.activeTag || task.tags.includes(filters.activeTag)) &&
        (!filters.activeObjective ||
          task.objective === filters.activeObjective) &&
        (!filters.activeDoerId || task.doer?.id === filters.activeDoerId),
    )
    .sort((a, b) => {
      if (!a.endDate && !b.endDate) return 0;
      if (!a.endDate) return 1;
      if (!b.endDate) return -1;
      return a.endDate < b.endDate ? -1 : a.endDate > b.endDate ? 1 : 0;
    });
}
