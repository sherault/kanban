"use client";

import { useCallback, useEffect } from "react";
import type { ReactNode } from "react";
import { listWikiPagesAction } from "@/actions/wiki";
import { WikiProvider, useWiki } from "@/context/WikiContext";

/**
 * The wiki page list is shared by the board (Cmd+K search) and the wiki route,
 * so it lives at the org layout. The fetch stays client-side: putting it in the
 * server layout would add a wiki round-trip to every org route render.
 */
export function OrgWikiProviderShell({
  orgId,
  children,
}: {
  orgId: string;
  children: ReactNode;
}) {
  return (
    <WikiProvider orgId={orgId}>
      <OrgWikiPagesLoader orgId={orgId}>{children}</OrgWikiPagesLoader>
    </WikiProvider>
  );
}

function OrgWikiPagesLoader({
  orgId,
  children,
}: {
  orgId: string;
  children: ReactNode;
}) {
  const { setPages, setIsLoading } = useWiki();

  const fetchPages = useCallback(async () => {
    try {
      setIsLoading(true);
      const result = await listWikiPagesAction(orgId);
      if (result.pages) setPages(result.pages);
    } catch (e) {
      console.error("Failed to fetch wiki pages", e);
    } finally {
      setIsLoading(false);
    }
  }, [orgId, setIsLoading, setPages]);

  useEffect(() => {
    const refresh = () => {
      void fetchPages();
    };
    window.addEventListener("kanban_wiki_page_updated", refresh);
    void fetchPages();
    return () => {
      window.removeEventListener("kanban_wiki_page_updated", refresh);
    };
  }, [fetchPages]);

  return <>{children}</>;
}
