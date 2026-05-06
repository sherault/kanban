import { useState, useTransition } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { DragEndEvent, DragStartEvent } from "@dnd-kit/core";
import { Column, type MembershipDto, type TaskDto } from "@kanban/shared";
import { archiveTasksAction, moveTaskAction } from "@/actions/tasks";

export function useBoardInteractions({
  tasks,
  setTasks,
  orgMembers,
  currentUserId,
  projectId,
}: {
  tasks: TaskDto[];
  setTasks: Dispatch<SetStateAction<TaskDto[]>>;
  orgMembers: MembershipDto[];
  currentUserId: string;
  projectId: string;
}) {
  const [activeTask, setActiveTask] = useState<TaskDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedDoneIds, setSelectedDoneIds] = useState<Set<string>>(
    new Set(),
  );
  const [archiving, setArchiving] = useState(false);
  const [, startTransition] = useTransition();

  function handleDragStart(event: DragStartEvent) {
    setActiveTask(tasks.find((task) => task.id === event.active.id) ?? null);
    setError(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;
    const taskId = active.id as string;
    const newColumn = over.id as Column;
    const task = tasks.find((item) => item.id === taskId);
    if (!task || task.column === newColumn) return;

    const optimisticDoer =
      newColumn === Column.DOING && !task.doer
        ? orgMembers.find((member) => member.userId === currentUserId)
        : null;
    setTasks((prev) =>
      prev.map((item) =>
        item.id === taskId
          ? {
              ...item,
              column: newColumn,
              ...(optimisticDoer
                ? {
                    doer: {
                      id: optimisticDoer.userId,
                      displayName: optimisticDoer.user.displayName,
                    },
                  }
                : {}),
            }
          : item,
      ),
    );

    startTransition(async () => {
      const result = await moveTaskAction(projectId, taskId, newColumn);
      if (result.error) {
        setTasks((prev) =>
          prev.map((item) => (item.id === taskId ? task : item)),
        );
        setError(result.error);
      } else if (result.task) {
        setTasks((prev) => upsertTask(prev, result.task!));
      }
    });
  }

  async function handleArchiveSelected() {
    if (selectedDoneIds.size === 0) return;
    setArchiving(true);
    const ids = Array.from(selectedDoneIds);
    const result = await archiveTasksAction(projectId, ids);
    setArchiving(false);
    if (result.error) {
      setError(result.error);
    } else {
      setTasks((prev) => prev.filter((task) => !ids.includes(task.id)));
      setSelectedDoneIds(new Set());
    }
  }

  function handleDoneSelection(taskId: string, selected: boolean) {
    setSelectedDoneIds((prev) => {
      const next = new Set(prev);
      if (selected) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  return {
    activeTask,
    error,
    setError,
    selectedDoneIds,
    setSelectedDoneIds,
    archiving,
    handleDragStart,
    handleDragEnd,
    handleArchiveSelected,
    handleDoneSelection,
  };
}

function upsertTask(tasks: TaskDto[], task: TaskDto) {
  const idx = tasks.findIndex((item) => item.id === task.id);
  if (idx < 0) return [...tasks, task];
  const next = [...tasks];
  next[idx] = task;
  return next;
}
