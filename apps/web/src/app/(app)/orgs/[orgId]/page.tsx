import { redirect } from "next/navigation";
import { api } from "../../../../lib/api";
import { getAccessToken } from "../../../../lib/session";
import { ProjectListClient } from "./ProjectListClient";

export default async function OrgPage({
  params,
}: {
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const { data: projects } = await api.projects.list(token, orgId);

  return (
    <div className="p-8 overflow-auto h-full bg-[#fcfcfd]">
      <ProjectListClient projects={projects} orgId={orgId} />
    </div>
  );
}
