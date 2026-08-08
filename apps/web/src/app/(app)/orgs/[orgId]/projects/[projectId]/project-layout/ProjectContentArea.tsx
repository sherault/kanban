import type { MembershipDto, TaskDto } from "@kanban/shared";
import type { ReactNode } from "react";
import { BoardClient } from "../BoardClient";

export function ProjectContentArea({
  initialTasks,
  orgMembers,
  projectId,
  orgId,
  currentUserId,
  userPreferences,
  children,
}: {
  initialTasks: TaskDto[];
  orgMembers: MembershipDto[];
  projectId: string;
  orgId: string;
  currentUserId: string;
  userPreferences: {
    maxOpenPanels: number;
    enableNotifications: boolean;
    maxNotifications: number;
    notificationDuration: number;
  };
  children: ReactNode;
}) {
  return (
    <main className="flex-1 overflow-hidden relative">
      <div className="h-full">
        <BoardClient
          initialTasks={initialTasks}
          orgMembers={orgMembers}
          projectId={projectId}
          orgId={orgId}
          currentUserId={currentUserId}
          maxOpenPanels={userPreferences.maxOpenPanels}
          enableNotifications={userPreferences.enableNotifications}
          maxNotifications={userPreferences.maxNotifications}
          notificationDuration={userPreferences.notificationDuration}
        />
      </div>
      <div className="hidden">{children}</div>
    </main>
  );
}
