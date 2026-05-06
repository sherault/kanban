import type { TaskDto } from "@kanban/shared";

export function TaskResults({
  tasks,
  search,
  isSearching,
  onSelect,
}: {
  tasks: Array<TaskDto & { projectName: string }>;
  search: string;
  isSearching: boolean;
  onSelect: (href: string, title?: string) => void;
}) {
  if (isSearching) {
    return (
      <div className="py-8 text-center text-gray-400">
        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
        <span className="text-xs">Searching tasks...</span>
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="py-8 text-center text-gray-400 text-xs">
        {search.length >= 2
          ? `No tasks found for "${search}"`
          : "Type at least 2 characters to search..."}
      </div>
    );
  }

  return (
    <>
      {tasks.map((task) => (
        <button
          key={task.id}
          onClick={() => onSelect(`task:${task.id}`, task.title)}
          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-50 group transition-all"
        >
          <div className="font-medium text-sm text-gray-900 group-hover:text-blue-700 truncate">
            {task.title}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] text-gray-400 font-mono">
              #{task.id.slice(0, 6)}
            </span>
            {task.projectName && (
              <span className="text-[10px] px-1 bg-gray-100 text-gray-400 rounded uppercase font-bold tracking-tighter">
                {task.projectName}
              </span>
            )}
          </div>
        </button>
      ))}
    </>
  );
}
