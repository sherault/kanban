import type { MembershipDto, TaskDto } from "@kanban/shared";
import type { Dispatch, SetStateAction } from "react";

export interface BoardClientProps {
  initialTasks: TaskDto[];
  orgMembers: MembershipDto[];
  projectId: string;
  orgId: string;
  currentUserId: string;
  maxOpenPanels: number;
  enableNotifications: boolean;
  maxNotifications: number;
  notificationDuration: number;
}

export interface OpenTaskPanel {
  id: string;
  archived?: boolean;
  data?: TaskDto;
}

export interface SidebarCommonProps {
  orgMembers: MembershipDto[];
  projectId: string;
  orgId: string;
  currentOpenTaskIds: string[];
  revision: number;
  objectives: string[];
  allTags: string[];
  setTasks: Dispatch<SetStateAction<TaskDto[]>>;
  setArchiveRevision: Dispatch<SetStateAction<number>>;
  setPanelWidths: Dispatch<SetStateAction<Record<string, number>>>;
  onActivateTask: (taskId: string) => void;
  onCloseTask: (taskId: string) => void;
  onCloseAllTasks: () => void;
  onOpenRelatedTask: (taskId: string) => void;
  openTasks: OpenTaskPanel[];
}
