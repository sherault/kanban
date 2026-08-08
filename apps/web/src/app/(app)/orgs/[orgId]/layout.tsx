import { OrgWikiProviderShell } from "./OrgWikiProviderShell";

export default async function OrgLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ orgId: string }>;
}) {
  const { orgId } = await params;
  return <OrgWikiProviderShell orgId={orgId}>{children}</OrgWikiProviderShell>;
}
