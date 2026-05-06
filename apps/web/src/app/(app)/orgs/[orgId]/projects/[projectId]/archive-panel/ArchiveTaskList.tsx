import type { TaskDto } from "@kanban/shared";

export function ArchiveTaskList({
  loading,
  tasks,
  search,
  isPending,
  onTaskClick,
  onRestore,
  onDelete,
}: {
  loading: boolean;
  tasks: TaskDto[];
  search: string;
  isPending: boolean;
  onTaskClick: (task: TaskDto) => void;
  onRestore: (taskId: string) => void;
  onDelete: (taskId: string) => void;
}) {
  return (
    <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
      {loading && <p className="text-xs text-gray-400 px-6 py-4">Loading...</p>}
      {!loading && tasks.length === 0 && (
        <p className="text-xs text-gray-400 px-6 py-4">
          No archived tasks{search ? " matching your search" : ""}.
        </p>
      )}
      {!loading &&
        tasks.map((task) => (
          <div
            key={task.id}
            onClick={() => onTaskClick(task)}
            className="flex items-center gap-3 px-6 py-2.5 hover:bg-gray-50 group cursor-pointer"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-800 truncate">
                {task.title}
              </p>
              <TaskMeta task={task} />
            </div>
            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onRestore(task.id);
                }}
                disabled={isPending}
                className="text-xs text-blue-500 hover:text-blue-700 disabled:opacity-50"
              >
                Restore
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(task.id);
                }}
                disabled={isPending}
                className="text-xs text-red-500 hover:text-red-700 disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        ))}
    </div>
  );
}

function TaskMeta({ task }: { task: TaskDto }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-0.5">
      {task.doer && (
        <span className="text-xs text-gray-400">{task.doer.displayName}</span>
      )}
      {task.validator && (
        <span className="text-xs text-gray-400 italic">
          {task.validator.displayName}
        </span>
      )}
      {task.tags.map((tag) => (
        <span
          key={tag}
          className="text-xs bg-gray-100 text-gray-500 px-1 rounded"
        >
          {tag}
        </span>
      ))}
      {task.archivedAt && (
        <span className="text-xs text-gray-300">
          {new Date(task.archivedAt).toLocaleDateString("en", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </span>
      )}
    </div>
  );
}
