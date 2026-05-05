"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { ProjectSidebar } from "./ProjectSidebar";
import { WikiSidebar } from "./WikiSidebar";
import { WikiProvider, useWiki } from "@/context/WikiContext";
import type { ProjectDto, TaskDto, MembershipDto } from "@kanban/shared";
import { listWikiPagesAction } from "@/actions/wiki";
import { searchTasksInOrgAction } from "@/actions/tasks";
import { BoardClient } from "./BoardClient";
import { WikiClient } from "./WikiClient";

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
    return (
      <div className="flex h-full overflow-hidden">
        <aside className="w-56 bg-white border-r border-gray-200 shrink-0 h-full" />
        <div className="flex-1 overflow-hidden" />
      </div>
    );
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
        <main className="flex-1 overflow-hidden relative">
          {/* We keep Board and Wiki mounted at all times but only show the active one */}
          <div
            className={`h-full ${activeTab === "board" ? "block" : "hidden"}`}
          >
            <BoardClient
              initialTasks={initialTasks}
              orgMembers={orgMembers}
              projectId={projectId}
              orgId={orgId}
              currentUserId={currentUserId}
              maxOpenPanels={userPreferences.maxOpenPanels}
              enableNotifications={userPreferences.enableNotifications}
              maxNotifications={userPreferences.maxNotifications}
              notificationDuration={userPreferences.notificationDuration}
            />
          </div>
          <div
            className={`h-full ${activeTab === "wiki" ? "block" : "hidden"}`}
          >
            <WikiClient
              orgId={orgId}
              projectId={projectId}
              tasks={initialTasks}
            />
          </div>

          {/* Children are rendered but hidden - they trigger route match */}
          <div className="hidden">{children}</div>
        </main>

        {/* Search Result Overlay */}
        {searchQuery && (
          <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
            <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
              <div className="flex items-center gap-2 text-gray-400">
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span className="text-[10px] font-bold uppercase tracking-wider">
                  Search Results
                </span>
              </div>
              <button
                onClick={() => setSearchQuery("")}
                className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-md transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="max-h-[400px] overflow-y-auto p-2">
              {filteredPages.length === 0 &&
              taskResults.length === 0 &&
              !isSearchingTasks ? (
                <div className="py-12 flex flex-col items-center gap-2">
                  <div className="p-3 bg-gray-50 rounded-full">
                    <svg
                      className="w-6 h-6 text-gray-300"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.172 9.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-900">
                      No results found
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Try searching for a different title or keyword.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredPages.length > 0 && (
                    <div>
                      <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        Wiki Pages
                      </div>
                      {filteredPages.map((p) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            router.push(
                              `/orgs/${orgId}/projects/${projectId}/wiki/${p.id}`,
                            );
                            setSearchQuery("");
                          }}
                          className="w-full text-left p-3 hover:bg-blue-50/50 rounded-lg flex items-start gap-3 transition-all group"
                        >
                          <div className="mt-1 p-1.5 bg-gray-100 rounded group-hover:bg-blue-100 transition-colors">
                            <svg
                              className="w-4 h-4 text-gray-500 group-hover:text-blue-600"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
                              {p.title}
                            </span>
                            <span className="text-xs text-gray-500 truncate mt-0.5">
                              Wiki • {p.slug}
                            </span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                  {(taskResults.length > 0 || isSearchingTasks) && (
                    <div>
                      <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        Tasks
                      </div>
                      {isSearchingTasks ? (
                        <div className="p-8 text-center">
                          <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        </div>
                      ) : (
                        taskResults.map((t) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              setActiveTab("board");
                              window.dispatchEvent(
                                new CustomEvent("kanban_open_task", {
                                  detail: t.id,
                                }),
                              );
                              setSearchQuery("");
                            }}
                            className="w-full text-left p-3 hover:bg-emerald-50/50 rounded-lg flex items-start gap-3 transition-all group"
                          >
                            <div className="mt-1 p-1.5 bg-gray-100 rounded group-hover:bg-emerald-100 transition-colors">
                              <svg
                                className="w-4 h-4 text-gray-500 group-hover:text-emerald-600"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                                />
                              </svg>
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
                                {t.title}
                              </span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-xs text-gray-500 truncate">
                                  Task • {t.projectName}
                                </span>
                                <span className="text-[10px] text-gray-300 font-mono">
                                  #{t.id.slice(0, 6)}
                                </span>
                              </div>
                            </div>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer Search Bar */}
        <div className="flex-none p-3 border-t border-gray-200 bg-white shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <div className="max-w-3xl mx-auto relative">
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search wiki, tasks or ask a question... (Cmd+K)"
              className="w-full bg-gray-100 border-none rounded-full px-5 py-2.5 text-sm focus:ring-2 focus:ring-blue-500/20 transition-all pl-11 shadow-inner"
            />
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400">
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
