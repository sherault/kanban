import { useEffect, useRef } from "react";
import type { Dispatch, SetStateAction } from "react";
import type { TaskDto } from "@kanban/shared";
import { useProjectSocket } from "@/hooks/useProjectSocket";
import type { NotificationData } from "@/components/NotificationsOverlay";
import type { OpenTaskPanel } from "./types";

export function useBoardRealtime({
  projectId,
  currentUserId,
  enableNotifications,
  notificationDuration,
  tasks,
  openTasks,
  setTasks,
  setOpenTasks,
  setExpandedIds,
  setSelectedDoneIds,
  setArchiveRevision,
  setSidebarRevision,
  setNotifications,
}: {
  projectId: string;
  currentUserId: string;
  enableNotifications: boolean;
  notificationDuration: number;
  tasks: TaskDto[];
  openTasks: OpenTaskPanel[];
  setTasks: Dispatch<SetStateAction<TaskDto[]>>;
  setOpenTasks: Dispatch<SetStateAction<OpenTaskPanel[]>>;
  setExpandedIds: Dispatch<SetStateAction<string[]>>;
  setSelectedDoneIds: Dispatch<SetStateAction<Set<string>>>;
  setArchiveRevision: Dispatch<SetStateAction<number>>;
  setSidebarRevision: Dispatch<SetStateAction<number>>;
  setNotifications: Dispatch<SetStateAction<NotificationData[]>>;
}) {
  const openTasksRef = useRef<OpenTaskPanel[]>([]);
  useEffect(() => {
    openTasksRef.current = openTasks;
  }, [openTasks]);

  return useProjectSocket(projectId, {
    onTaskCreated(task, actorId, isMcp) {
      const actor = actorId ?? "";
      const fromMcp = Boolean(isMcp);
      setTasks((prev) => upsertTask(prev, task));
      setArchiveRevision((v) => v + 1);
      notify({
        enabled: enableNotifications && (actor !== currentUserId || fromMcp),
        setNotifications,
        notificationDuration,
        actorId: actor,
        currentUserId,
        isMcp: fromMcp,
        type: "task.created",
        taskId: task.id,
        message: `Task "${task.title}" was created.`,
      });
    },
    onTaskUpdated(task, actorId, isMcp) {
      const actor = actorId ?? "";
      const fromMcp = Boolean(isMcp);
      setTasks((prev) => prev.map((t) => (t.id !== task.id ? t : task)));
      if (openTasksRef.current.some((t) => t.id === task.id)) {
        const focused = document.activeElement;
        if (!(focused?.closest('[data-sidebar="true"]') ?? false)) {
          setSidebarRevision((v) => v + 1);
        }
      }
      setOpenTasks((prev) =>
        prev.map((open) =>
          open.id === task.id ? { ...open, data: task } : open,
        ),
      );
      setArchiveRevision((v) => v + 1);
      notify({
        enabled: enableNotifications && (actor !== currentUserId || fromMcp),
        setNotifications,
        notificationDuration,
        actorId: actor,
        currentUserId,
        isMcp: fromMcp,
        type: "task.updated",
        taskId: task.id,
        message: `Task "${task.title}" was updated.`,
      });
    },
    onTaskDeleted(taskId, actorId, isMcp) {
      const actor = actorId ?? "";
      const fromMcp = Boolean(isMcp);
      setTasks((prev) => prev.filter((task) => task.id !== taskId));
      setSelectedDoneIds((prev) => {
        const next = new Set(prev);
        next.delete(taskId);
        return next;
      });
      setOpenTasks((prev) => prev.filter((task) => task.id !== taskId));
      setExpandedIds((prev) => prev.filter((id) => id !== taskId));
      setArchiveRevision((v) => v + 1);
      const task = tasks.find((item) => item.id === taskId);
      notify({
        enabled: enableNotifications && (actor !== currentUserId || fromMcp),
        setNotifications,
        notificationDuration,
        actorId: actor,
        currentUserId,
        isMcp: fromMcp,
        type: "task.deleted",
        taskId,
        message: `Task "${task?.title || taskId}" was deleted.`,
      });
    },
  });
}

function upsertTask(tasks: TaskDto[], task: TaskDto) {
  const idx = tasks.findIndex((item) => item.id === task.id);
  if (idx < 0) return [...tasks, task];
  const next = [...tasks];
  next[idx] = task;
  return next;
}

function notify({
  enabled,
  setNotifications,
  notificationDuration,
  actorId,
  currentUserId,
  isMcp,
  type,
  taskId,
  message,
}: {
  enabled: boolean;
  setNotifications: Dispatch<SetStateAction<NotificationData[]>>;
  notificationDuration: number;
  actorId: string;
  currentUserId: string;
  isMcp: boolean;
  type: NotificationData["type"];
  taskId: string;
  message: string;
}) {
  if (!enabled) return;
  setNotifications((prev) => [
    ...prev,
    {
      id: Math.random().toString(36).substring(7),
      type,
      taskId,
      message,
      duration: notificationDuration,
      isSelfMcp: actorId === currentUserId && isMcp,
    },
  ]);
}
