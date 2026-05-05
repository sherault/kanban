"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { BoardClient } from "./BoardClient";
import { WikiClient } from "./WikiClient";
import type { TaskDto, MembershipDto } from "@kanban/shared";

interface Props {
  initialTasks: TaskDto[];
  orgMembers: MembershipDto[];
  projectId: string;
  orgId: string;
  currentUserId: string;
  maxOpenPanels: number;
  enableNotifications: boolean;
  maxNotifications: number;
  notificationDuration: number;
}

export function ProjectViewManager(props: Props) {
  const [activeTab, setActiveTab] = useState<"board" | "wiki">("board");
  const [isHydrated, setIsHydrated] = useState(false);
  const searchParams = useSearchParams();
  const wikiPageId = searchParams.get("wikiPageId");

  useEffect(() => {
    const saved = localStorage.getItem("kanban_active_tab") as "board" | "wiki";
    if (wikiPageId) {
      setActiveTab("wiki");
      // Wait for WikiClient to be mounted/listening
      setTimeout(() => {
        window.dispatchEvent(
          new CustomEvent("kanban_open_wiki_page", { detail: wikiPageId }),
        );
      }, 100);
    } else if (saved) {
      queueMicrotask(() => setActiveTab(saved));
    }
    queueMicrotask(() => setIsHydrated(true));

    const handleTabChange = (e: Event) => {
      if (!(e instanceof CustomEvent)) return;
      if (e.detail === "board" || e.detail === "wiki") {
        setActiveTab(e.detail);
      }
    };

    window.addEventListener("kanban_tab_changed", handleTabChange);
    return () =>
      window.removeEventListener("kanban_tab_changed", handleTabChange);
  }, [wikiPageId]);

  if (!isHydrated) return null;

  return (
    <>
      <div className={activeTab === "board" ? "block h-full" : "hidden"}>
        <BoardClient {...props} />
      </div>
      <div className={activeTab === "wiki" ? "block h-full" : "hidden"}>
        <WikiClient
          orgId={props.orgId}
          projectId={props.projectId}
          tasks={props.initialTasks}
        />
      </div>
    </>
  );
}
