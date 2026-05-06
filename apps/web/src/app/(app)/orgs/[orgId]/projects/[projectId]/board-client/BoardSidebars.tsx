import type { Dispatch, ReactNode, SetStateAction } from "react";
import type { MembershipDto, TaskDto } from "@kanban/shared";
import { TaskSidebarInstance } from "./TaskSidebarInstance";
import type { OpenTaskPanel, SidebarCommonProps } from "./types";

export function BoardSidebars(props: {
  tasks: TaskDto[];
  openTasks: OpenTaskPanel[];
  expandedIds: string[];
  panelWidths: Record<string, number>;
  stableShells: Map<string, { taskId: string }>;
  orgMembers: MembershipDto[];
  projectId: string;
  orgId: string;
  sidebarRevision: number;
  objectives: string[];
  allTags: string[];
  setTasks: Dispatch<SetStateAction<TaskDto[]>>;
  setPanelWidths: Dispatch<SetStateAction<Record<string, number>>>;
  setArchiveRevision: Dispatch<SetStateAction<number>>;
  onActivateTask: (taskId: string) => void;
  onOpenAsComparison: (taskId: string, archived?: boolean) => void;
  onCloseTask: (taskId: string) => void;
  onCloseAllTasks: () => void;
  onOpenRelatedTask: (taskId: string) => void;
  onFoldPanel: (taskId: string) => void;
}) {
  const {
    tasks,
    openTasks,
    expandedIds,
    panelWidths,
    stableShells,
    onOpenAsComparison,
    onFoldPanel,
  } = props;
  if (openTasks.length === 0) return null;

  const foldedTasks = openTasks.filter(
    (task) => !expandedIds.includes(task.id),
  );
  const expandedTasks = expandedIds
    .map((id) => openTasks.find((task) => task.id === id))
    .filter((task): task is OpenTaskPanel => !!task);
  const totalFoldedWidth = foldedTasks.length * 48;
  const common = getCommonProps(props);

  return (
    <div className="absolute top-0 bottom-0 right-0 z-[60] w-full pointer-events-none">
      {foldedTasks.map((openTask, idx) => (
        <SidebarFrame
          key={openTask.id}
          width={48}
          rightOffset={idx * 48}
          zIndex={10 + idx}
        >
          <TaskSidebarInstance
            openTask={openTask}
            isExpanded={false}
            isActive={false}
            width={48}
            task={tasks.find((task) => task.id === openTask.id)}
            stableShells={stableShells}
            common={common}
            onOpenAsComparison={
              expandedIds.length > 0
                ? () => onOpenAsComparison(openTask.id)
                : undefined
            }
          />
        </SidebarFrame>
      ))}

      {expandedTasks.map((openTask, idx) => {
        const rightPanelWidth =
          panelWidths[expandedTasks[expandedTasks.length - 1]?.id] || 384;
        const rightOffset =
          idx === expandedTasks.length - 1
            ? totalFoldedWidth
            : totalFoldedWidth + rightPanelWidth;
        return (
          <SidebarFrame
            key={openTask.id}
            rightOffset={rightOffset}
            zIndex={20 + idx}
          >
            <TaskSidebarInstance
              openTask={openTask}
              isExpanded
              isActive={idx === expandedTasks.length - 1}
              width={panelWidths[openTask.id] || 384}
              task={tasks.find((task) => task.id === openTask.id)}
              stableShells={stableShells}
              common={common}
              onFold={
                idx === 0 && expandedTasks.length > 1
                  ? () => onFoldPanel(openTask.id)
                  : undefined
              }
            />
          </SidebarFrame>
        );
      })}
    </div>
  );
}

function getCommonProps(
  props: Parameters<typeof BoardSidebars>[0],
): SidebarCommonProps {
  return {
    orgMembers: props.orgMembers,
    projectId: props.projectId,
    orgId: props.orgId,
    currentOpenTaskIds: props.openTasks.map((task) => task.id),
    revision: props.sidebarRevision,
    objectives: props.objectives,
    allTags: props.allTags,
    setTasks: props.setTasks,
    setArchiveRevision: props.setArchiveRevision,
    setPanelWidths: props.setPanelWidths,
    onActivateTask: props.onActivateTask,
    onCloseTask: props.onCloseTask,
    onCloseAllTasks: props.onCloseAllTasks,
    onOpenRelatedTask: props.onOpenRelatedTask,
    openTasks: props.openTasks,
  };
}

function SidebarFrame({
  rightOffset,
  zIndex,
  width,
  children,
}: {
  rightOffset: number;
  zIndex: number;
  width?: number;
  children: ReactNode;
}) {
  return (
    <div
      className="pointer-events-auto h-full absolute top-0"
      style={{
        right: rightOffset,
        width,
        zIndex,
        boxShadow: width
          ? "-4px 0 12px rgba(0,0,0,0.08)"
          : "-10px 0 30px rgba(0,0,0,0.15)",
        transition: "right 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {children}
    </div>
  );
}
