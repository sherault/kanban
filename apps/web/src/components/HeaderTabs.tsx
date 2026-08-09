"use client";

import { usePathname, useRouter, useParams } from "next/navigation";
import { readActiveProject } from "@/lib/activeProjectSession";

export function HeaderTabs() {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string | undefined;

  const isProjectRoute = pathname.includes("/projects/");
  const isWikiRoute = /^\/orgs\/[^/]+\/wiki(\/|$)/.test(pathname);
  const activeTab = pathname.includes("/wiki") ? "wiki" : "board";

  // Storage is read in the handler, never during render: sessionStorage does
  // not exist on the server and reading it in render desyncs hydration.
  const goToBoard = () => {
    if (!orgId) return;
    const projectId = readActiveProject(orgId);
    router.push(
      projectId ? `/orgs/${orgId}/projects/${projectId}` : `/orgs/${orgId}`,
    );
  };

  const goToWiki = () => {
    if (!orgId) return;
    router.push(`/orgs/${orgId}/wiki`);
  };

  if (!orgId || (!isProjectRoute && !isWikiRoute)) return null;

  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1">
      <button
        onClick={goToBoard}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
          activeTab === "board"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Board
      </button>
      <button
        onClick={goToWiki}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
          activeTab === "wiki"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Wiki
      </button>
    </div>
  );
}
