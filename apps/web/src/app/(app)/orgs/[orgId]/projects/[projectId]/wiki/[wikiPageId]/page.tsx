import { permanentRedirect } from "next/navigation";

export default async function ProjectWikiPageRedirect({
  params,
}: {
  params: Promise<{ orgId: string; projectId: string; wikiPageId: string }>;
}) {
  const { orgId, projectId, wikiPageId } = await params;
  permanentRedirect(`/orgs/${orgId}/wiki/${wikiPageId}?from=${projectId}`);
}
