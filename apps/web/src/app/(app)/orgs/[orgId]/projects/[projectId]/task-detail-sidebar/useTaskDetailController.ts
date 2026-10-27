import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import type { MouseEvent as ReactMouseEvent } from "react";
import type { ProjectDto, TaskDto, TaskHistoryDto } from "@kanban/shared";
import {
  addAdvisorAction,
  addTagAction,
  addWatcherAction,
  deleteTaskAction,
  getTaskByIdAction,
  getTaskHistoryAction,
  removeAdvisorAction,
  removeTagAction,
  removeWatcherAction,
  transferTaskAction,
  updateTaskAction,
} from "@/actions/tasks";
import { listProjectsAction } from "@/actions/projects";
import { getActiveConflict } from "./conflicts";
import { resolveTaskShell } from "./taskShell";
import { useTaskLinks } from "./useTaskLinks";
import { useConflictField } from "./useConflictField";
import type { TaskDetailSidebarProps, TaskUpdateBody } from "./types";

export function useTaskDetailController({
  task: initialTask,
  projectId,
  orgId,
  revision,
  onUpdated,
  onDeleted,
  width,
  onWidthChange,
}: TaskDetailSidebarProps) {
  const { isShell, initialId, initialTaskDto } = resolveTaskShell(initialTask);
  const [task, setTask] = useState<TaskDto | null>(initialTaskDto);
  const [loading, setLoading] = useState(isShell);
  const [history, setHistory] = useState<TaskHistoryDto[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [projects, setProjects] = useState<ProjectDto[] | null>(null);
  const [isPending, startTransition] = useTransition();
  const [prevInitialTask, setPrevInitialTask] = useState(initialTask);

  if (!isShell && prevInitialTask !== initialTask) {
    setPrevInitialTask(initialTask);
    setTask(initialTaskDto);
  }

  useEffect(() => {
    if (!isShell || !initialId || task?.id === initialId) return;
    let cancelled = false;
    void loadTask();
    return () => {
      cancelled = true;
    };

    async function loadTask() {
      setLoading(true);
      const res = await getTaskByIdAction(initialId!);
      if (cancelled) return;
      if (res.task) setTask(res.task);
      setLoading(false);
    }
  }, [isShell, initialId, task?.id]);

  const taskLinks = useTaskLinks({ task, projectId, onUpdated });

  const onResizeMouseDown = useCallback(
    (e: ReactMouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startW = width;
      function onMove(ev: MouseEvent) {
        const delta = startX - ev.clientX;
        onWidthChange(Math.min(1200, Math.max(384, startW + delta)));
      }
      function onUp() {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      }
      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [width, onWidthChange],
  );

  const titleField = useConflictField(task?.title || "");
  const descField = useConflictField(task?.description ?? "");
  const objField = useConflictField(task?.objective ?? "");
  const subjectField = useConflictField(task?.globalSubject ?? "");
  const prevTaskRef = useRef(task);

  useEffect(() => {
    if (!task || !prevTaskRef.current) {
      prevTaskRef.current = task;
      return;
    }
    const prev = prevTaskRef.current;
    prevTaskRef.current = task;
    if (task.title !== prev.title) titleField.setValue(task.title || "");
    if (task.description !== prev.description)
      descField.setValue(task.description ?? "");
    if (task.objective !== prev.objective)
      objField.setValue(task.objective ?? "");
    if (task.globalSubject !== prev.globalSubject)
      subjectField.setValue(task.globalSubject ?? "");
  }, [task, titleField, descField, objField, subjectField]);

  function save(body: TaskUpdateBody) {
    if (!task) return;
    setSaveError(null);
    startTransition(async () => {
      const result = await updateTaskAction(projectId, task.id, body);
      if (result.error) setSaveError(result.error);
      else if (result.task) onUpdated(result.task);
    });
  }

  function handleDelete() {
    if (!task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    startTransition(async () => {
      const result = await deleteTaskAction(projectId, task.id);
      if (result.error) setSaveError(result.error);
      else onDeleted(task.id);
    });
  }

  const loadProjects = useCallback(() => {
    if (projects !== null) return;
    void listProjectsAction(orgId).then((res) => {
      if (res.projects) setProjects(res.projects);
      else if (res.error) setSaveError(res.error);
    });
  }, [orgId, projects]);

  function handleTransfer(targetProjectId: string) {
    if (!task || !targetProjectId) return;
    setSaveError(null);
    startTransition(async () => {
      // The task's own project, not the board's: an external task opened
      // here must be addressed where it lives.
      const result = await transferTaskAction(
        task.projectId,
        task.id,
        targetProjectId,
      );
      if (result.error) setSaveError(result.error);
      else onDeleted(task.id);
    });
  }

  const mutateTask = (
    action: () => Promise<{ task?: TaskDto; error?: string }>,
  ) => {
    if (!task) return;
    startTransition(async () => {
      const result = await action();
      if (result.task) onUpdated(result.task);
    });
  };

  useEffect(() => {
    if (showHistory) loadProjects();
  }, [showHistory, loadProjects]);

  useEffect(() => {
    if (!showHistory || !task?.id) return;
    void getTaskHistoryAction(projectId, task.id).then((res) => {
      if (res.history) setHistory(res.history);
    });
  }, [showHistory, revision, projectId, task?.id]);

  return {
    task,
    loading,
    history,
    showHistory,
    setShowHistory,
    projects,
    loadProjects,
    handleTransfer,
    linkedTasks: taskLinks.linkedTasks,
    loadingLinks: taskLinks.loadingLinks,
    isPending,
    saveError,
    confirmDelete,
    setConfirmDelete,
    onResizeMouseDown,
    fields: { titleField, descField, objField, subjectField },
    activeConflict: getActiveConflict(
      titleField,
      descField,
      objField,
      subjectField,
    ),
    save,
    handleDelete,
    addLink: taskLinks.addLink,
    removeLink: taskLinks.removeLink,
    handleTagAdd: (tag: string) =>
      mutateTask(() => addTagAction(projectId, task!.id, tag)),
    handleTagRemove: (tag: string) =>
      mutateTask(() => removeTagAction(projectId, task!.id, tag)),
    handleWatcherAdd: (userId: string) =>
      mutateTask(() => addWatcherAction(projectId, task!.id, userId)),
    handleWatcherRemove: (userId: string) =>
      mutateTask(() => removeWatcherAction(projectId, task!.id, userId)),
    handleAdvisorAdd: (userId: string) =>
      mutateTask(() => addAdvisorAction(projectId, task!.id, userId)),
    handleAdvisorRemove: (userId: string) =>
      mutateTask(() => removeAdvisorAction(projectId, task!.id, userId)),
  };
}
