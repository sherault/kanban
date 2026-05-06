"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createWikiPageAction } from "@/actions/wiki";

interface UseWikiSidebarCreatePageParams {
  orgId: string;
  projectId: string;
  onRefresh: () => void;
}

export function useWikiSidebarCreatePage({
  orgId,
  projectId,
  onRefresh,
}: UseWikiSidebarCreatePageParams) {
  const router = useRouter();

  useEffect(() => {
    const handleCreatePage = async () => {
      try {
        const result = await createWikiPageAction(orgId, {
          title: "New Page",
          content: "# New Page\n\nEdit this page content...",
        });
        if (!result.page) {
          if (result.error) {
            console.error("Failed to create wiki page", result.error);
          }
          return;
        }
        onRefresh();
        router.push(
          `/orgs/${orgId}/projects/${projectId}/wiki/${result.page.id}`,
        );
        window.dispatchEvent(
          new CustomEvent("kanban_open_wiki_page", { detail: result.page.id }),
        );
      } catch (error) {
        console.error("Failed to create wiki page", error);
      }
    };

    window.addEventListener("kanban_create_wiki_page", handleCreatePage);
    return () => {
      window.removeEventListener("kanban_create_wiki_page", handleCreatePage);
    };
  }, [orgId, projectId, onRefresh, router]);
}
