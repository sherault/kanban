import type { MembershipDto, TaskDto } from "@kanban/shared";
import type { ReactNode } from "react";
import { BoardClient } from "../BoardClient";
import { WikiClient } from "../WikiClient";

export function ProjectContentArea({
  activeTab,
  initialTasks,
  orgMembers,
  projectId,
  orgId,
  currentUserId,
  userPreferences,
  children,
}: {
  activeTab: "board" | "wiki";
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
      <div className={`h-full ${activeTab === "board" ? "block" : "hidden"}`}>
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
      <div className={`h-full ${activeTab === "wiki" ? "block" : "hidden"}`}>
        <WikiClient orgId={orgId} projectId={projectId} tasks={initialTasks} />
      </div>
      <div className="hidden">{children}</div>
    </main>
  );
}
