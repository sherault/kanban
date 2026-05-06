import { useMemo, useState } from "react";
import type { TaskDto } from "@kanban/shared";

export function useSyncedTasks(initialTasks: TaskDto[]) {
  const [tasks, setTasks] = useState(initialTasks);
  const [prevInitialTasks, setPrevInitialTasks] = useState(initialTasks);

  if (prevInitialTasks !== initialTasks) {
    setPrevInitialTasks(initialTasks);
    setTasks(initialTasks);
  }

  return [tasks, setTasks] as const;
}

export function useBoardFilterOptions(
  tasks: TaskDto[],
  activeDoerId: string | null,
) {
  const objectives = useMemo(
    () => [
      ...new Set(
        tasks.flatMap((task) => (task.objective ? [task.objective] : [])),
      ),
    ],
    [tasks],
  );
  const allTags = useMemo(
    () => [...new Set(tasks.flatMap((task) => task.tags))],
    [tasks],
  );
  const activeDoerName = activeDoerId
    ? (tasks.find((task) => task.doer?.id === activeDoerId)?.doer
        ?.displayName ?? activeDoerId)
    : null;

  return { objectives, allTags, activeDoerName };
}

export function upsertTask(tasks: TaskDto[], task: TaskDto) {
  const idx = tasks.findIndex((item) => item.id === task.id);
  if (idx < 0) return [...tasks, task];
  const next = [...tasks];
  next[idx] = task;
  return next;
}
