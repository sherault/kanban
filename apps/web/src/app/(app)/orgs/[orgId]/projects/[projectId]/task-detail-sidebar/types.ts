import type { MembershipDto, TaskDto } from "@kanban/shared";
import type { updateTaskAction } from "@/actions/tasks";

export type TaskDetailShell = TaskDto | { taskId: string; id?: string };
export type TaskUpdateBody = Parameters<typeof updateTaskAction>[2];

export interface TaskDetailSidebarProps {
  task: TaskDetailShell;
  orgMembers: MembershipDto[];
  projectId: string;
  orgId: string;
  currentOpenTaskIds: string[];
  revision: number;
  objectives: string[];
  allTags: string[];
  onClose: () => void;
  onUpdated: (task: TaskDto) => void;
  onDeleted: (taskId: string) => void;
  onCloseAll?: () => void;
  onOpenRelatedTask?: (taskId: string) => void;
  showCloseAll?: boolean;
  isActive: boolean;
  isExpanded: boolean;
  onActivate: () => void;
  onFold?: () => void;
  onOpenAsComparison?: () => void;
  width: number;
  onWidthChange: (width: number) => void;
}

export interface ConflictInfo {
  ours: string;
  theirs: string;
}

export interface ConflictField {
  value: string;
  setValue: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
  conflict: ConflictInfo | null;
  resolveConflict: (choice: "ours" | "theirs") => void;
}
