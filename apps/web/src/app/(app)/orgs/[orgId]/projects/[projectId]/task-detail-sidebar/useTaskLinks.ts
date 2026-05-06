import { useEffect, useState } from "react";
import type { TaskDto } from "@kanban/shared";
import {
  addLinkAction,
  getTaskByIdAction,
  removeLinkAction,
} from "@/actions/tasks";

export function useTaskLinks({
  task,
  projectId,
  onUpdated,
}: {
  task: TaskDto | null;
  projectId: string;
  onUpdated: (task: TaskDto) => void;
}) {
  const [linkedTasks, setLinkedTasks] = useState<TaskDto[]>([]);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const linkedIdsString = task?.linkedTaskIds.join(",") ?? "";

  useEffect(() => {
    let cancelled = false;
    const linkedTaskIds = linkedIdsString ? linkedIdsString.split(",") : [];
    void loadLinkedTasks();
    return () => {
      cancelled = true;
    };

    async function loadLinkedTasks() {
      if (!task?.id || linkedTaskIds.length === 0) {
        if (!cancelled) setLinkedTasks([]);
        return;
      }
      if (!cancelled) setLoadingLinks(true);
      const results = await Promise.all(
        linkedTaskIds.map((id) => getTaskByIdAction(id)),
      );
      if (cancelled) return;
      setLinkedTasks(
        results.map((res) => res.task).filter((t): t is TaskDto => !!t),
      );
      setLoadingLinks(false);
    }
  }, [task?.id, linkedIdsString]);

  async function addLink(targetId: string) {
    if (!task || !targetId || targetId === task.id) return;
    const result = await addLinkAction(projectId, task.id, targetId);
    if (result.task) onUpdated(result.task);
  }

  async function removeLink(targetId: string) {
    if (!task) return;
    const result = await removeLinkAction(projectId, task.id, targetId);
    if (result.task) onUpdated(result.task);
  }

  return { linkedTasks, loadingLinks, addLink, removeLink };
}
