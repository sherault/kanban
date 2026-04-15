import { redirect } from "next/navigation";
import { api } from "../../../../../../../lib/api";
import { getAccessToken, getUserId } from "../../../../../../../lib/session";
import { ProjectSettingsClient } from "./ProjectSettingsClient";
import type { Role } from "@kanban/shared";

export default async function ProjectSettingsPage({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>;
}) {
  const { orgId, projectId } = await params;
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const currentUserId = await getUserId();

  const [{ data: projects }, { data: members }] = await Promise.all([
    api.projects.list(token, orgId),
    api.orgs.listMembers(token, orgId),
  ]);

  const project = projects.find((p) => p.id === projectId);
  if (!project) redirect(`/orgs/${orgId}`);

  const currentMember = members.find((m) => m.userId === currentUserId);
  const currentUserRole: Role = currentMember?.role ?? "member";

  return (
    <ProjectSettingsClient
      project={project}
      orgId={orgId}
      currentUserId={currentUserId ?? ""}
      currentUserRole={currentUserRole}
    />
  );
}
