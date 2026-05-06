import type { TaskDto } from "@kanban/shared";

export function LinkedTasksSection({
  task,
  linkedTasks,
  loadingLinks,
  projectId,
  onOpenRelatedTask,
  onAddLink,
  onRemoveLink,
}: {
  task: TaskDto;
  linkedTasks: TaskDto[];
  loadingLinks: boolean;
  projectId: string;
  onOpenRelatedTask?: (taskId: string) => void;
  onAddLink: (taskId: string) => Promise<void>;
  onRemoveLink: (taskId: string) => Promise<void>;
}) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
        Linked Tasks
      </label>
      <div className="space-y-1.5">
        {(task.linkedTaskIds || []).map((linkId) => (
          <LinkedTaskRow
            key={linkId}
            linkId={linkId}
            linkedTask={linkedTasks.find((lt) => lt.id === linkId)}
            loadingLinks={loadingLinks}
            projectId={projectId}
            onOpenRelatedTask={onOpenRelatedTask}
            onRemoveLink={onRemoveLink}
          />
        ))}

        <div className="pt-1">
          <input
            type="text"
            placeholder="Paste task ID to link..."
            className="w-full text-[11px] border border-gray-100 rounded px-2 py-1 focus:outline-none focus:border-blue-300 transition-all bg-gray-50/50"
            onKeyDown={async (e) => {
              if (e.key !== "Enter") return;
              const targetId = e.currentTarget.value.trim();
              await onAddLink(targetId);
              e.currentTarget.value = "";
            }}
          />
        </div>
      </div>
    </div>
  );
}

function LinkedTaskRow({
  linkId,
  linkedTask,
  loadingLinks,
  projectId,
  onOpenRelatedTask,
  onRemoveLink,
}: {
  linkId: string;
  linkedTask: TaskDto | undefined;
  loadingLinks: boolean;
  projectId: string;
  onOpenRelatedTask?: (taskId: string) => void;
  onRemoveLink: (taskId: string) => Promise<void>;
}) {
  const isNotFound = !loadingLinks && !linkedTask;
  return (
    <div className="group flex items-center justify-between p-2 rounded-md hover:bg-gray-50 border border-transparent hover:border-gray-100 transition-all">
      <div className="flex items-center gap-2 min-w-0">
        {isNotFound ? (
          <div
            className="flex items-center gap-1.5 text-red-500"
            title="Task does not exist anymore"
          >
            <span className="text-xs">❌</span>
            <span className="text-xs font-mono truncate max-w-[120px]">
              {linkId}
            </span>
          </div>
        ) : (
          <button
            onClick={() => onOpenRelatedTask?.(linkId)}
            className="text-xs text-gray-700 hover:text-blue-600 truncate text-left"
          >
            <span className="font-medium">{linkedTask?.title}</span>
            {linkedTask?.projectId !== projectId && (
              <span className="ml-1.5 px-1 bg-gray-100 text-[9px] text-gray-500 rounded font-normal uppercase">
                {linkedTask?.projectName}
              </span>
            )}
          </button>
        )}
      </div>
      <button
        onClick={() => void onRemoveLink(linkId)}
        className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 text-xs transition-all"
      >
        Remove
      </button>
    </div>
  );
}
