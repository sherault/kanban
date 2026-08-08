"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import type { ProjectDto } from "@kanban/shared";
import {
  readActiveProject,
  writeActiveProject,
} from "@/lib/activeProjectSession";
import { WikiClient } from "./WikiClient";
import { WikiSidebar } from "./WikiSidebar";

export function OrgWikiLayout({
  orgId,
  projects,
  enableSecondBrain,
  children,
}: {
  orgId: string;
  projects: ProjectDto[];
  enableSecondBrain: boolean;
  children: ReactNode;
}) {
  const searchParams = useSearchParams();
  const fromProjectId = searchParams.get("from");
  const activeProjects = projects.filter((project) => !project.archivedAt);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );

  // sessionStorage is unreadable during render, so the selection is resolved
  // after hydration: the `from` hint of a redirected old URL wins, then the
  // session, then the first non-archived project.
  useEffect(() => {
    const hinted =
      fromProjectId &&
      activeProjects.some((project) => project.id === fromProjectId)
        ? fromProjectId
        : null;
    if (hinted) {
      writeActiveProject(orgId, hinted);
      setSelectedProjectId(hinted);
      return;
    }
    const stored = readActiveProject(orgId);
    const valid =
      stored && activeProjects.some((project) => project.id === stored)
        ? stored
        : (activeProjects[0]?.id ?? null);
    setSelectedProjectId(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, fromProjectId, projects]);

  const selectProject = useCallback(
    (projectId: string) => {
      writeActiveProject(orgId, projectId);
      setSelectedProjectId(projectId);
    },
    [orgId],
  );

  const refresh = useCallback(() => {
    window.dispatchEvent(new Event("kanban_wiki_page_updated"));
  }, []);

  return (
    <div className="flex h-full overflow-hidden">
      <WikiSidebar
        orgId={orgId}
        projects={activeProjects}
        selectedProjectId={selectedProjectId}
        onSelectProject={selectProject}
        enableSecondBrain={enableSecondBrain}
        onRefresh={refresh}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <WikiClient orgId={orgId} sessionProjectId={selectedProjectId} />
        <div className="hidden">{children}</div>
      </div>
    </div>
  );
}
