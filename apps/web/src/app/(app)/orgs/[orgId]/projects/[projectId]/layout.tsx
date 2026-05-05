import { redirect } from "next/navigation";
import { api } from "../../../../../../lib/api";
import { getAccessToken } from "../../../../../../lib/session";
import { getProjectViewDataAction } from "../../../../../../actions/projects";
import { ProjectClientLayout } from "./ProjectClientLayout";

export default async function BoardLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string; projectId: string }>;
}) {
  const { orgId, projectId } = await params;
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const { data: projects } = await api.projects.list(token, orgId);
  const { tasks, members, me, currentUserId } = await getProjectViewDataAction(
    orgId,
    projectId,
  );

  return (
    <ProjectClientLayout
      projects={projects}
      orgId={orgId}
      projectId={projectId}
      initialTasks={tasks}
      orgMembers={members}
      currentUserId={currentUserId}
      userPreferences={me}
    >
      {children}
    </ProjectClientLayout>
  );
}
