"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { deleteWikiPageAction } from "@/actions/wiki";
import { useWiki } from "@/context/WikiContext";

interface UseWikiPageDeletionParams {
  orgId: string;
  projectId: string;
  onDeleted: () => void;
}

/**
 * Deleting a page cascades over its descendants, so the open tabs of the whole
 * subtree have to go with it — otherwise they'd point at rows that no longer
 * exist until the next reload prunes them.
 */
export function useWikiPageDeletion({
  orgId,
  projectId,
  onDeleted,
}: UseWikiPageDeletionParams) {
  const router = useRouter();
  const params = useParams();
  const { setSplits } = useWiki();
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deletePage = async (pageId: string, descendantIds: string[]) => {
    setIsDeleting(true);
    setError(null);
    try {
      const result = await deleteWikiPageAction(pageId);
      if (result.error) {
        setError(result.error);
        return false;
      }

      const removed = new Set([pageId, ...descendantIds]);
      setSplits((prev) =>
        prev.map((split) => {
          const openPageIds = split.openPageIds.filter(
            (id) => !removed.has(id),
          );
          if (openPageIds.length === split.openPageIds.length) return split;
          const activePageId =
            split.activePageId && removed.has(split.activePageId)
              ? (openPageIds[openPageIds.length - 1] ?? null)
              : split.activePageId;
          return { activePageId, openPageIds };
        }),
      );

      const urlPageId = params.wikiPageId as string | undefined;
      if (urlPageId && removed.has(urlPageId)) {
        router.push(`/orgs/${orgId}/projects/${projectId}/wiki`);
      }

      onDeleted();
      return true;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete wiki page");
      return false;
    } finally {
      setIsDeleting(false);
    }
  };

  return { deletePage, isDeleting, error, resetError: () => setError(null) };
}
