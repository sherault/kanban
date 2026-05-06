"use client";

import { useContext, useEffect, useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import type { TaskDto } from "@kanban/shared";
import { getTaskCached } from "./cache";
import { DescriptionEditorContext } from "./context";

export function TaskLink({
  taskId,
  children,
}: {
  taskId: string;
  children: ReactNode;
}) {
  const params = useParams();
  const currentProjectId = params.projectId as string;
  const [task, setTask] = useState<TaskDto | null>(null);
  const [error, setError] = useState(false);
  const { onOpenTask } = useContext(DescriptionEditorContext);

  useEffect(() => {
    if (!taskId) return;
    void getTaskCached(taskId).then((res) => {
      if (res && res.task) setTask(res.task);
      else if (res && res.error) setError(true);
    });
  }, [taskId]);

  const isOtherProject = task && task.projectId !== currentProjectId;
  let bgColor = "bg-blue-50 hover:bg-blue-100 border-blue-100 text-blue-700";
  if (error)
    bgColor = "bg-red-50 border-red-100 text-red-500 cursor-not-allowed";
  else if (isOtherProject)
    bgColor =
      "bg-yellow-50 hover:bg-yellow-100 border-yellow-200 text-yellow-700";

  return (
    <button
      type="button"
      disabled={error}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        if (onOpenTask) onOpenTask(taskId);
      }}
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[13px] font-medium transition-colors border ${bgColor}`}
    >
      <span className="text-[10px] opacity-70">#</span>
      {error ? (
        <span className="flex items-center gap-1 uppercase text-[10px] font-bold">
          <s>{children}</s>
          <span className="text-[10px] font-bold">DELETED</span>
        </span>
      ) : (
        task?.title || children
      )}
    </button>
  );
}
