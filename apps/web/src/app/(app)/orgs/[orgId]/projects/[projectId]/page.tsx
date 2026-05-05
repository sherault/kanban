import { redirect } from "next/navigation";
import { api } from "../../../../../../lib/api";
import { getAccessToken, getUserId } from "../../../../../../lib/session";
import { ProjectViewManager } from "./ProjectViewManager";

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>;
}) {
  const { orgId, projectId } = await params;
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const [{ data: tasks }, { data: members }, { data: me }, currentUserId] =
    await Promise.all([
      api.tasks.list(token, projectId),
      api.orgs.listMembers(token, orgId),
      api.auth.me(token),
      getUserId(),
    ]);

  return (
    <ProjectViewManager
      initialTasks={tasks}
      orgMembers={members}
      projectId={projectId}
      orgId={orgId}
      currentUserId={currentUserId ?? ""}
      maxOpenPanels={me.maxOpenPanels}
      enableNotifications={me.enableNotifications}
      maxNotifications={me.maxNotifications}
      notificationDuration={me.notificationDuration}
    />
  );
}
