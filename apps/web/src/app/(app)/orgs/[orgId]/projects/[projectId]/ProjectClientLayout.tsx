"use client";
import React, { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { ProjectSidebar } from "./ProjectSidebar";
import { useWiki } from "@/context/WikiContext";
import type { ProjectDto, TaskDto, MembershipDto } from "@kanban/shared";
import { searchTasksInOrgAction } from "@/actions/tasks";
import { ArchivedProjectBanner } from "./project-layout/ArchivedProjectBanner";
import { ProjectContentArea } from "./project-layout/ProjectContentArea";
import { ProjectHydrationSkeleton } from "./project-layout/ProjectHydrationSkeleton";
import { ProjectSearchFooter } from "./project-layout/ProjectSearchFooter";
import { ProjectSearchOverlay } from "./project-layout/ProjectSearchOverlay";
import { writeActiveProject } from "@/lib/activeProjectSession";
interface Props {
  projects: ProjectDto[];
  orgId: string;
  projectId: string;
  children: React.ReactNode;
  initialTasks: TaskDto[];
  orgMembers: MembershipDto[];
  currentUserId: string;
  userPreferences: {
    maxOpenPanels: number;
    enableNotifications: boolean;
    maxNotifications: number;
    notificationDuration: number;
  };
}
export function ProjectClientLayout({
  projects,
  orgId,
  projectId,
  children,
  initialTasks,
  orgMembers,
  currentUserId,
  userPreferences,
}: Props) {
  const router = useRouter();
  const [isHydrated, setIsHydrated] = useState(false);
  const { pages } = useWiki();
  const [searchQuery, setSearchQuery] = useState("");
  const [taskResults, setTaskResults] = useState<
    Array<TaskDto & { projectName: string }>
  >([]);
  const [isSearchingTasks, setIsSearchingTasks] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setIsHydrated(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // The wiki has no project in its URL; this is how the Board tab and the
  // Second Brain panel know which project the tab was last working on.
  useEffect(() => {
    writeActiveProject(orgId, projectId);
  }, [orgId, projectId]);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setTaskResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingTasks(true);
      try {
        const res = await searchTasksInOrgAction(orgId, searchQuery);
        if (res.tasks) {
          setTaskResults(res.tasks);
        }
      } catch (e) {
        console.error("Task search failed", e);
      } finally {
        setIsSearchingTasks(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, orgId]);

  if (!isHydrated) {
    return <ProjectHydrationSkeleton />;
  }

  const currentProject = projects.find((p) => p.id === projectId);
  const filteredPages = pages.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex h-full overflow-hidden">
      <ProjectSidebar projects={projects} orgId={orgId} projectId={projectId} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        {currentProject?.archivedAt && (
          <ArchivedProjectBanner projectName={currentProject.name} />
        )}
        <ProjectContentArea
          initialTasks={initialTasks}
          orgMembers={orgMembers}
          projectId={projectId}
          orgId={orgId}
          currentUserId={currentUserId}
          userPreferences={userPreferences}
        >
          {children}
        </ProjectContentArea>

        <ProjectSearchOverlay
          searchQuery={searchQuery}
          filteredPages={filteredPages}
          taskResults={taskResults}
          isSearchingTasks={isSearchingTasks}
          orgId={orgId}
          onClear={() => setSearchQuery("")}
          onOpenWiki={(url) => {
            router.push(url);
            setSearchQuery("");
          }}
          onOpenTask={(taskId) => {
            window.dispatchEvent(
              new CustomEvent("kanban_open_task", { detail: taskId }),
            );
            setSearchQuery("");
          }}
        />

        <ProjectSearchFooter
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>
    </div>
  );
}
