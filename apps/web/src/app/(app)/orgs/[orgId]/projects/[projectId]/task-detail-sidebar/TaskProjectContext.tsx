import Link from "next/link";
import type { TaskDto } from "@kanban/shared";

export function TaskProjectContext({
  task,
  orgId,
  projectId,
  currentOpenTaskIds,
}: {
  task: TaskDto;
  orgId: string;
  projectId: string;
  currentOpenTaskIds: string[];
}) {
  return (
    <div className="mb-[-12px]">
      <Link
        href={`/orgs/${orgId}/projects/${task.projectId}?tasks=${(currentOpenTaskIds || []).join(",")}`}
        className={`text-[10px] uppercase font-bold tracking-widest flex items-center gap-1 transition-colors ${
          task.projectId !== projectId
            ? "text-amber-600 hover:text-amber-700"
            : "text-gray-400 hover:text-gray-600"
        }`}
      >
        <span className="opacity-70">Project:</span>
        <span className="truncate">{task.projectName || task.projectId}</span>
        {task.projectId !== projectId && (
          <span className="ml-1 text-[8px] bg-amber-100 text-amber-700 px-1 rounded">
            External
          </span>
        )}
      </Link>
    </div>
  );
}
