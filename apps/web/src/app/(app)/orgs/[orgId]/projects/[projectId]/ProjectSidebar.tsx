"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import type { ProjectDto } from "@kanban/shared";

interface Props {
  projects: ProjectDto[];
  orgId: string;
  projectId: string;
}

export function ProjectSidebar({ projects, orgId, projectId }: Props) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isTempExpanded, setIsTempExpanded] = useState(false);
  const [isHydrated, setIsHydrated] = useState(false);
  const hoverTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem("kanban_sidebar_collapsed");
    if (saved === "true") {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIsCollapsed(true);
    }
    setIsHydrated(true);
  }, []);

  const toggleCollapse = (e: React.MouseEvent) => {
    e.stopPropagation();
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem("kanban_sidebar_collapsed", String(next));
    if (next) setIsTempExpanded(false);
  };

  const handleMouseEnter = () => {
    if (!isCollapsed) return;
    hoverTimerRef.current = setTimeout(() => {
      setIsTempExpanded(true);
    }, 500);
  };

  const handleMouseLeave = () => {
    if (hoverTimerRef.current) {
      clearTimeout(hoverTimerRef.current);
      hoverTimerRef.current = null;
    }
    setIsTempExpanded(false);
  };

  if (!isHydrated) {
    return (
      <aside className="w-56 bg-white border-r border-gray-200 shrink-0 h-full" />
    );
  }

  const actuallyExpanded = !isCollapsed || isTempExpanded;

  return (
    <div
      className={`relative h-full shrink-0 z-40 transition-all duration-300 ease-in-out ${
        isCollapsed ? "w-4" : "w-56"
      }`}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <aside
        className={`h-full bg-white border-r border-gray-200 transition-all duration-300 ease-in-out flex flex-col max-h-full shadow-none ${
          actuallyExpanded ? "w-56" : "w-4"
        } ${isCollapsed ? "absolute top-0 left-0 z-[100] shadow-2xl" : "relative"}`}
      >
        {/* Toggle Button */}
        <button
          onClick={toggleCollapse}
          className={`absolute -right-3 top-[48px] -translate-y-1/2 z-[110] w-6 h-6 bg-white border border-gray-200 rounded-full flex items-center justify-center text-[10px] text-gray-400 hover:text-gray-600 hover:border-gray-300 shadow-sm transition-all ${
            actuallyExpanded ? "rotate-0 text-gray-600" : "rotate-180"
          }`}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed && !isTempExpanded ? "▶" : "◀"}
        </button>

        {/* Sidebar Content */}
        <div
          className={`flex-1 flex flex-col min-h-0 overflow-hidden transition-opacity duration-200 ${
            actuallyExpanded ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}
          style={{ width: "224px" }}
        >
          {/* Header - Fixed Height for precise alignment */}
          <div className="flex-none h-12 px-4 flex items-center border-b border-gray-100">
            <Link
              href="/orgs"
              className="text-xs font-semibold text-gray-400 uppercase tracking-wide hover:text-gray-600 transition-colors"
            >
              ← Organizations
            </Link>
          </div>

          {/* Project List - Scrollable */}
          <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
            {projects.map((p) => (
              <div key={p.id} className="group flex items-center gap-1">
                <Link
                  href={`/orgs/${orgId}/projects/${p.id}`}
                  className={`flex-1 flex items-center px-3 py-2 rounded-md text-sm transition-colors truncate ${
                    p.id === projectId
                      ? "bg-blue-50 text-blue-700 font-medium"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {p.name}
                </Link>
                <Link
                  href={`/orgs/${orgId}/projects/${p.id}/settings`}
                  className="shrink-0 px-1 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-all text-sm"
                  title="Settings"
                >
                  ⚙️
                </Link>
              </div>
            ))}
          </nav>

          {/* Footer - Fixed at bottom */}
          <div className="flex-none p-2 border-t border-gray-100 space-y-1 bg-white">
            <Link
              href={`/orgs/${orgId}/projects/new`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-100 transition-colors"
            >
              <span className="text-blue-500 font-bold">+</span> New project
            </Link>
            <Link
              href={`/orgs/${orgId}/settings`}
              className="flex items-center gap-1.5 px-3 py-2 rounded-md text-sm text-gray-500 hover:bg-gray-100 transition-colors"
            >
              Settings
            </Link>
          </div>
        </div>

        {/* Collapsed Indicator / Trigger Area */}
        {!actuallyExpanded && (
          <div className="absolute inset-0 flex flex-col items-center py-12 gap-4 cursor-pointer">
            <div className="w-1 h-32 bg-gray-100 rounded-full transition-colors group-hover:bg-blue-300" />
          </div>
        )}
      </aside>
    </div>
  );
}
