"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

export function HeaderTabs() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<"board" | "wiki">("board");

  useEffect(() => {
    // Initial check
    const saved = localStorage.getItem("kanban_active_tab");
    if (saved === "wiki" || pathname.includes("/wiki")) {
      setActiveTab("wiki");
    } else {
      setActiveTab("board");
    }

    const handleTabChangedEvent = (e: Event) => {
      if (!(e instanceof CustomEvent)) return;
      if (e.detail === "board" || e.detail === "wiki") {
        setActiveTab(e.detail);
      }
    };

    window.addEventListener("kanban_tab_changed", handleTabChangedEvent);
    return () =>
      window.removeEventListener("kanban_tab_changed", handleTabChangedEvent);
  }, [pathname]);

  const handleTabChange = (tab: "board" | "wiki") => {
    setActiveTab(tab);
    localStorage.setItem("kanban_active_tab", tab);
    // Dispatch a custom event to notify other components (like BoardClient/WikiClient)
    window.dispatchEvent(
      new CustomEvent("kanban_tab_changed", { detail: tab }),
    );
  };

  // Only show on project pages (not on the organization/project list pages)
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
