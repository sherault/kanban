"use client";
import React, { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ProjectSidebar } from "./ProjectSidebar";
import { WikiSidebar } from "./WikiSidebar";
import { WikiProvider, useWiki } from "@/context/WikiContext";
import type { ProjectDto, TaskDto, MembershipDto } from "@kanban/shared";
import { listWikiPagesAction } from "@/actions/wiki";
import { searchTasksInOrgAction } from "@/actions/tasks";
import { ProjectContentArea } from "./project-layout/ProjectContentArea";
import { ProjectHydrationSkeleton } from "./project-layout/ProjectHydrationSkeleton";
import { ProjectSearchFooter } from "./project-layout/ProjectSearchFooter";
import { ProjectSearchOverlay } from "./project-layout/ProjectSearchOverlay";
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
export function ProjectClientLayout(props: Props) {
  return (
    <WikiProvider orgId={props.orgId}>
      <ProjectClientLayoutInner {...props} />
    </WikiProvider>
  );
}
function ProjectClientLayoutInner({
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
  const pathname = usePathname();
  const isWikiPath = pathname.includes("/wiki");

  const [activeTab, setActiveTab] = useState<"board" | "wiki">(
    isWikiPath ? "wiki" : "board",
  );
  const [isHydrated, setIsHydrated] = useState(false);
  const { pages, setPages, setIsLoading: setIsLoadingPages } = useWiki();
  const [searchQuery, setSearchQuery] = useState("");
  const [taskResults, setTaskResults] = useState<
    Array<TaskDto & { projectName: string }>
  >([]);
  const [isSearchingTasks, setIsSearchingTasks] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const fetchPages = useCallback(async () => {
    try {
      setIsLoadingPages(true);
      const result = await listWikiPagesAction(orgId);
      if (result.pages) {
        setPages(result.pages);
      }
    } catch (e) {
      console.error("Failed to fetch wiki pages", e);
    } finally {
      setIsLoadingPages(false);
    }
  }, [orgId, setIsLoadingPages, setPages]);

  useEffect(() => {
    setActiveTab(isWikiPath ? "wiki" : "board");
  }, [isWikiPath]);

  useEffect(() => {
    setIsHydrated(true);

    const handleTabChangeMessage = (e: Event) => {
      if (!(e instanceof CustomEvent)) return;
      if (e.detail === "board" || e.detail === "wiki") {
        setActiveTab(e.detail);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("kanban_tab_changed", handleTabChangeMessage);
    window.addEventListener("kanban_wiki_page_updated", fetchPages);
    window.addEventListener("keydown", handleKeyDown);

    void fetchPages();

    return () => {
      window.removeEventListener("kanban_tab_changed", handleTabChangeMessage);
      window.removeEventListener("kanban_wiki_page_updated", fetchPages);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [fetchPages]);

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

  const filteredPages = pages.filter((p) =>
    p.title.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  return (
    <div className="flex h-full overflow-hidden">
      {activeTab === "board" ? (
        <ProjectSidebar
          projects={projects}
          orgId={orgId}
          projectId={projectId}
        />
      ) : (
        <WikiSidebar
          orgId={orgId}
          projectId={projectId}
          onRefresh={fetchPages}
        />
      )}

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <ProjectContentArea
          activeTab={activeTab}
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
          projectId={projectId}
          onClear={() => setSearchQuery("")}
          onOpenWiki={(url) => {
            router.push(url);
            setSearchQuery("");
          }}
          onOpenTask={(taskId) => {
            setActiveTab("board");
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
