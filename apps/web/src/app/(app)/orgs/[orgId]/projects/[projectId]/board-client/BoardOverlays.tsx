import type { Dispatch, SetStateAction } from "react";
import type { Column} from "@kanban/shared";
import { type MembershipDto, type TaskDto } from "@kanban/shared";
import {
  NotificationsOverlay,
  type NotificationData,
} from "@/components/NotificationsOverlay";
import { CsvImportModal } from "../CsvImportModal";
import { NewTaskModal } from "../NewTaskModal";
import { BoardSidebars } from "./BoardSidebars";
import type { OpenTaskPanel } from "./types";

export function BoardOverlays({
  isMounted,
  showImport,
  newTaskColumn,
  notifications,
  enableNotifications,
  maxNotifications,
  panels,
  tasks,
  orgMembers,
  projectId,
  orgId,
  sidebarRevision,
  objectives,
  allTags,
  setTasks,
  setShowImport,
  setNewTaskColumn,
  setNotifications,
  setArchiveRevision,
}: {
  isMounted: boolean;
  showImport: boolean;
  newTaskColumn: Column | null;
  notifications: NotificationData[];
  enableNotifications: boolean;
  maxNotifications: number;
  panels: {
    openTasks: OpenTaskPanel[];
    expandedIds: string[];
    panelWidths: Record<string, number>;
    stableShells: Map<string, { taskId: string }>;
    panelsRightOffset: number;
    setPanelWidths: Dispatch<SetStateAction<Record<string, number>>>;
    handleActivateTask: (taskId: string) => void;
    handleOpenAsComparison: (taskId: string, archived?: boolean) => void;
    handleCloseTask: (taskId: string) => void;
    handleCloseAllTasks: () => void;
    handleOpenTask: (taskId: string, archived?: boolean) => void;
    handleFoldPanel: (taskId: string) => void;
  };
  tasks: TaskDto[];
  orgMembers: MembershipDto[];
  projectId: string;
  orgId: string;
  sidebarRevision: number;
  objectives: string[];
  allTags: string[];
  setTasks: Dispatch<SetStateAction<TaskDto[]>>;
  setShowImport: Dispatch<SetStateAction<boolean>>;
  setNewTaskColumn: Dispatch<SetStateAction<Column | null>>;
  setNotifications: Dispatch<SetStateAction<NotificationData[]>>;
  setArchiveRevision: Dispatch<SetStateAction<number>>;
}) {
  return (
    <>
      {isMounted && (
        <BoardSidebars
          tasks={tasks}
          openTasks={panels.openTasks}
          expandedIds={panels.expandedIds}
          panelWidths={panels.panelWidths}
          stableShells={panels.stableShells}
          orgMembers={orgMembers}
          projectId={projectId}
          orgId={orgId}
          sidebarRevision={sidebarRevision}
          objectives={objectives}
          allTags={allTags}
          setTasks={setTasks}
          setPanelWidths={panels.setPanelWidths}
          setArchiveRevision={setArchiveRevision}
          onActivateTask={panels.handleActivateTask}
          onOpenAsComparison={panels.handleOpenAsComparison}
          onCloseTask={panels.handleCloseTask}
          onCloseAllTasks={panels.handleCloseAllTasks}
          onOpenRelatedTask={panels.handleOpenTask}
          onFoldPanel={panels.handleFoldPanel}
        />
      )}
      {showImport && (
        <CsvImportModal
          projectId={projectId}
          onClose={() => setShowImport(false)}
          onImported={() => setShowImport(false)}
        />
      )}
      {newTaskColumn !== null && (
        <NewTaskModal
          projectId={projectId}
          orgId={orgId}
          initialColumn={newTaskColumn}
          orgMembers={orgMembers}
          objectives={objectives}
          allTags={allTags}
          onClose={() => setNewTaskColumn(null)}
          onCreated={(task) => {
            setTasks((prev) =>
              prev.some((item) => item.id === task.id) ? prev : [...prev, task],
            );
            setNewTaskColumn(null);
          }}
        />
      )}
      {enableNotifications && notifications.length > 0 && (
        <NotificationsOverlay
          notifications={notifications}
          maxNotifications={maxNotifications}
          onClose={(id) =>
            setNotifications((prev) => prev.filter((item) => item.id !== id))
          }
          onClickTask={panels.handleOpenTask}
          rightOffset={panels.panelsRightOffset}
        />
      )}
    </>
  );
}
