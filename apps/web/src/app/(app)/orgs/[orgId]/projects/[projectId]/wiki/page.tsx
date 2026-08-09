import { permanentRedirect } from "next/navigation";

// The wiki moved to /orgs/[orgId]/wiki. Old links carry the project forward as
// `from` so the Board tab and the Second Brain panel keep their target.
export default async function ProjectWikiRedirect({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string }>;
}) {
  const { orgId, projectId } = await params;
  permanentRedirect(`/orgs/${orgId}/wiki?from=${projectId}`);
}
