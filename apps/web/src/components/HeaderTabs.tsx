"use client";

import { usePathname, useRouter, useParams } from "next/navigation";
import { useEffect, useState } from "react";

interface Props {
  activeTab?: "board" | "wiki";
  onTabChange?: (tab: "board" | "wiki") => void;
}

export function HeaderTabs({ activeTab: propActiveTab, onTabChange }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams();
  const orgId = params.orgId as string;
  const projectId = params.projectId as string;

  const currentTab = pathname.includes("/wiki") ? "wiki" : "board";
  const [internalActiveTab, setInternalActiveTab] = useState<"board" | "wiki">(
    currentTab,
  );

  // Sync state if pathname changes
  useEffect(() => {
    setInternalActiveTab(currentTab);
  }, [currentTab]);

  const activeTab = propActiveTab ?? internalActiveTab;

  const handleTabChange = (tab: "board" | "wiki") => {
    if (onTabChange) {
      onTabChange(tab);
    } else {
      setInternalActiveTab(tab);
      if (tab === "board") {
        router.push(`/orgs/${orgId}/projects/${projectId}`);
      } else {
        router.push(`/orgs/${orgId}/projects/${projectId}/wiki`);
      }
    }
  };

  // Only show on project pages
  if (!pathname.includes("/projects/")) return null;

  return (
    <div className="flex items-center bg-gray-100 rounded-lg p-1">
      <button
        onClick={() => handleTabChange("board")}
        className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${
          activeTab === "board"
            ? "bg-white text-gray-900 shadow-sm"
            : "text-gray-500 hover:text-gray-700"
        }`}
      >
        Board
      </button>
      <button
        onClick={() => handleTabChange("wiki")}
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
