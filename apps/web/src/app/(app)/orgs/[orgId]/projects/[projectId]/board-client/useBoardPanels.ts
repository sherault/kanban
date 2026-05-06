import { useEffect, useMemo, useState } from "react";
import type { OpenTaskPanel } from "./types";

export function useBoardPanels({
  orgId,
  maxOpenPanels,
  isMounted,
}: {
  orgId: string;
  maxOpenPanels: number;
  isMounted: boolean;
}) {
  const [openTasks, setOpenTasks] = useState<OpenTaskPanel[]>([]);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [panelWidths, setPanelWidths] = useState<Record<string, number>>({});
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setIsHydrated(false);
      const saved = localStorage.getItem(`kanban_open_tasks_${orgId}`);
      const savedExpanded = localStorage.getItem(
        `kanban_expanded_panels_${orgId}`,
      );
      setOpenTasks(parseSaved(saved, []));
      setExpandedIds(parseSaved(savedExpanded, []));
      setIsHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, [orgId]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(
        `kanban_open_tasks_${orgId}`,
        JSON.stringify(openTasks),
      );
    }
  }, [openTasks, isHydrated, orgId]);

  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(
        `kanban_expanded_panels_${orgId}`,
        JSON.stringify(expandedIds),
      );
    }
  }, [expandedIds, isHydrated, orgId]);

  const stableShells = useMemo(() => {
    const map = new Map<string, { taskId: string }>();
    openTasks.forEach((task) => map.set(task.id, { taskId: task.id }));
    return map;
  }, [openTasks]);

  const handleOpenTask = (taskId: string, archived?: boolean) => {
    setOpenTasks((prev) =>
      appendOpenTask(prev, { id: taskId, archived }, maxOpenPanels),
    );
    setExpandedIds((prev) => {
      if (prev.includes(taskId)) return prev;
      if (prev.length >= 2) return [prev[0], taskId];
      return [taskId];
    });
  };

  const handleOpenAsComparison = (taskId: string, archived?: boolean) => {
    setOpenTasks((prev) =>
      appendOpenTask(prev, { id: taskId, archived }, maxOpenPanels),
    );
    setExpandedIds((prev) => {
      const currentRight = prev.length > 0 ? prev[prev.length - 1] : null;
      if (!currentRight || currentRight === taskId) return [taskId];
      return [taskId, currentRight];
    });
  };

  const handleCloseTask = (taskId: string) => {
    setOpenTasks((prev) => prev.filter((task) => task.id !== taskId));
    setExpandedIds((prev) => prev.filter((id) => id !== taskId));
  };

  const handleCloseAllTasks = () => {
    setOpenTasks([]);
    setExpandedIds([]);
  };

  const sidebarTotalWidth = useMemo(
    () => calculatePanelWidth(openTasks, expandedIds, panelWidths),
    [openTasks, expandedIds, panelWidths],
  );
  const panelsRightOffset = useMemo(
    () =>
      isMounted ? calculatePanelWidth(openTasks, expandedIds, panelWidths) : 0,
    [isMounted, openTasks, expandedIds, panelWidths],
  );

  return {
    openTasks,
    setOpenTasks,
    expandedIds,
    setExpandedIds,
    panelWidths,
    setPanelWidths,
    stableShells,
    sidebarTotalWidth,
    panelsRightOffset,
    handleOpenTask,
    handleOpenAsComparison,
    handleActivateTask: handleOpenTask,
    handleFoldPanel: (taskId: string) =>
      setExpandedIds((prev) => prev.filter((id) => id !== taskId)),
    handleCloseTask,
    handleCloseAllTasks,
  };
}

function parseSaved<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch (e) {
    console.error("Failed to parse board panel state", e);
    return fallback;
  }
}

function appendOpenTask(
  prev: OpenTaskPanel[],
  nextTask: OpenTaskPanel,
  maxOpenPanels: number,
) {
  const existing = prev.find((task) => task.id === nextTask.id);
  const next = existing
    ? [...prev.filter((task) => task.id !== nextTask.id), existing]
    : [...prev, nextTask];
  return next.length > maxOpenPanels
    ? next.slice(next.length - maxOpenPanels)
    : next;
}

function calculatePanelWidth(
  openTasks: OpenTaskPanel[],
  expandedIds: string[],
  panelWidths: Record<string, number>,
) {
  if (openTasks.length === 0) return 0;
  const foldedCount = openTasks.filter(
    (task) => !expandedIds.includes(task.id),
  ).length;
  const expandedWidth = expandedIds.reduce(
    (sum, id) => sum + (panelWidths[id] || 384),
    0,
  );
  return expandedWidth + foldedCount * 48;
}
