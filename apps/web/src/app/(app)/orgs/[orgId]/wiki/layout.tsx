import { redirect } from "next/navigation";
import { api } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { OrgWikiLayout } from "./OrgWikiLayout";

export default async function WikiLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  const token = await getAccessToken();
  if (!token) redirect("/login");

  const [{ data: projects }, { data: me }] = await Promise.all([
    api.projects.list(token, orgId),
    api.auth.me(token),
  ]);

  return (
    <OrgWikiLayout
      orgId={orgId}
      projects={projects}
      enableSecondBrain={me.enableSecondBrain}
    >
      {children}
    </OrgWikiLayout>
  );
}
