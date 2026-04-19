import { redirect } from "next/navigation";
import { api } from "../../../../../../lib/api";
import { getAccessToken } from "../../../../../../lib/session";
import { ProjectSidebar } from "./ProjectSidebar";

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

  return (
    <div className="flex h-full overflow-hidden">
      <ProjectSidebar projects={projects} orgId={orgId} projectId={projectId} />

      <div className="flex-1 overflow-hidden">{children}</div>
    </div>
  );
}
