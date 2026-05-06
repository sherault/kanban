import type { TaskDto } from "@kanban/shared";
import { getDisplayInitials } from "./initials";

interface TaskCardContentProps {
  date: Date | null;
  isMounted: boolean;
  isOverdue: boolean;
  task: TaskDto;
  onDoerClick?: (userId: string) => void;
  onObjectiveClick?: (objective: string) => void;
  onTagClick?: (tag: string) => void;
}

export function TaskCardContent({
  date,
  isMounted,
  isOverdue,
  task,
  onDoerClick,
  onObjectiveClick,
  onTagClick,
}: TaskCardContentProps) {
  const initials = getDisplayInitials(task.doer?.displayName);

  return (
    <>
      <p className="text-sm text-gray-900 font-medium leading-snug mb-2 line-clamp-2">
        {task.title}
      </p>
      <div className="flex items-center justify-between gap-2">
        {isMounted && date && (
          <span
            className={`text-xs ${isOverdue ? "text-red-500 font-medium" : "text-gray-400"}`}
          >
            {date.toLocaleDateString("en", { month: "short", day: "numeric" })}
          </span>
        )}
        {initials && (
          <span
            onClick={
              onDoerClick
                ? (event) => {
                    event.stopPropagation();
                    onDoerClick(task.doer!.id);
                  }
                : undefined
            }
            className={`inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold shrink-0 ${onDoerClick ? "cursor-pointer hover:bg-blue-200" : ""}`}
            title={task.doer?.displayName}
          >
            {initials}
          </span>
        )}
      </div>
      {task.objective && (
        <div
          className="text-xs text-gray-400 italic mt-1.5 line-clamp-1"
          title={task.objective}
        >
          <span
            onClick={
              onObjectiveClick
                ? (event) => {
                    event.stopPropagation();
                    onObjectiveClick(task.objective || "");
                  }
                : undefined
            }
            className={
              onObjectiveClick ? "cursor-pointer hover:text-purple-600" : ""
            }
          >
            {task.objective}
          </span>
        </div>
      )}
      {task.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1.5">
          {task.tags.map((tag) => (
            <span
              key={tag}
              onClick={
                onTagClick
                  ? (event) => {
                      event.stopPropagation();
                      onTagClick(tag);
                    }
                  : undefined
              }
              className={`text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded ${onTagClick ? "hover:bg-blue-100 hover:text-blue-700 cursor-pointer" : ""}`}
            >
              {tag}
            </span>
          ))}
        </div>
      )}
    </>
  );
}
