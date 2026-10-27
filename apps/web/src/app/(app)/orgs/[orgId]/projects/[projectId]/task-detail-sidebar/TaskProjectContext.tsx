import Link from "next/link";
import { useState } from "react";
import type { ProjectDto, TaskDto } from "@kanban/shared";

export function TaskProjectContext({
  task,
  orgId,
  projectId,
  currentOpenTaskIds,
  projects,
  isPending,
  onLoadProjects,
  onTransfer,
}: {
  task: TaskDto;
  orgId: string;
  projectId: string;
  currentOpenTaskIds: string[];
  projects: ProjectDto[] | null;
  isPending: boolean;
  onLoadProjects: () => void;
  onTransfer: (targetProjectId: string) => void;
}) {
  const [picking, setPicking] = useState(false);
  const [targetId, setTargetId] = useState("");
  const targets = (projects ?? [])
    .filter((project) => project.id !== task.projectId)
    .sort(
      (a, b) =>
        Number(a.archivedAt !== null) - Number(b.archivedAt !== null) ||
        a.name.localeCompare(b.name),
    );

  return (
    <div className="mb-[-12px]">
      <div className="flex items-center gap-2">
        <Link
          href={`/orgs/${orgId}/projects/${task.projectId}?tasks=${(currentOpenTaskIds || []).join(",")}`}
          className={`text-[10px] uppercase font-bold tracking-widest flex items-center gap-1 transition-colors min-w-0 ${
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
        {!picking && (
          <button
            onClick={() => {
              onLoadProjects();
              setPicking(true);
            }}
            className="text-[10px] uppercase font-bold tracking-widest text-gray-400 hover:text-violet-600 transition-colors shrink-0"
            title="Transfer this task to another project"
          >
            Transfer…
          </button>
        )}
      </div>
      {picking && (
        <div className="mt-2 flex items-center gap-2">
          {projects === null ? (
            <span className="text-xs text-gray-400">Loading projects…</span>
          ) : targets.length === 0 ? (
            <span className="text-xs text-gray-400">No other project.</span>
          ) : (
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className="text-xs border border-gray-200 rounded px-2 py-1 min-w-0 flex-1"
            >
              <option value="">Transfer to…</option>
              {targets.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                  {project.archivedAt !== null ? " (archived)" : ""}
                </option>
              ))}
            </select>
          )}
          <button
            onClick={() => {
              setPicking(false);
              setTargetId("");
            }}
            className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
          >
            Cancel
          </button>
          <button
            onClick={() => onTransfer(targetId)}
            disabled={!targetId || isPending}
            className="text-xs bg-violet-600 text-white px-3 py-1 rounded hover:bg-violet-700 disabled:opacity-50"
          >
            Transfer
          </button>
        </div>
      )}
    </div>
  );
}
