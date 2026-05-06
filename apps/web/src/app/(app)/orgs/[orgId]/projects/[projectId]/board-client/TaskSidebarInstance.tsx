import type { TaskDto } from "@kanban/shared";
import { TaskDetailSidebar } from "../TaskDetailSidebar";
import type { OpenTaskPanel, SidebarCommonProps } from "./types";

export function TaskSidebarInstance({
  openTask,
  task,
  stableShells,
  common,
  isExpanded,
  isActive,
  width,
  onFold,
  onOpenAsComparison,
}: {
  openTask: OpenTaskPanel;
  task: TaskDto | undefined;
  stableShells: Map<string, { taskId: string }>;
  common: SidebarCommonProps;
  isExpanded: boolean;
  isActive: boolean;
  width: number;
  onFold?: () => void;
  onOpenAsComparison?: () => void;
}) {
  return (
    <TaskDetailSidebar
      task={
        task ||
        openTask.data ||
        stableShells.get(openTask.id) || {
          taskId: openTask.id,
        }
      }
      orgMembers={common.orgMembers}
      projectId={common.projectId}
      orgId={common.orgId}
      currentOpenTaskIds={common.currentOpenTaskIds}
      revision={common.revision}
      objectives={common.objectives}
      allTags={common.allTags}
      isActive={isActive}
      isExpanded={isExpanded}
      onActivate={() => common.onActivateTask(openTask.id)}
      onFold={onFold}
      onOpenAsComparison={onOpenAsComparison}
      onClose={() => common.onCloseTask(openTask.id)}
      showCloseAll={isExpanded && common.openTasks.length > 1 && isActive}
      onCloseAll={common.onCloseAllTasks}
      width={width}
      onWidthChange={(nextWidth) => {
        common.setPanelWidths((prev) => ({
          ...prev,
          [openTask.id]: nextWidth,
        }));
      }}
      onUpdated={(updated) => {
        common.setTasks((prev) =>
          prev.map((item) => (item.id === updated.id ? updated : item)),
        );
      }}
      onDeleted={(taskId) => {
        common.setTasks((prev) => prev.filter((item) => item.id !== taskId));
        common.onCloseTask(taskId);
        common.setArchiveRevision((value) => value + 1);
      }}
      onOpenRelatedTask={common.onOpenRelatedTask}
    />
  );
}
