"use client";

import { useRouter } from "next/navigation";
import type { WikiPageSummaryDto } from "@kanban/shared";
import type { MouseEvent, ReactNode } from "react";

function DisabledLink({ children }: { children: ReactNode }) {
  return (
    <span
      className="opacity-50 cursor-not-allowed"
      title="External Organization"
    >
      {children}
    </span>
  );
}

export function MarkdownLink({
  href,
  children,
  currentOrgId,
  projectId,
  pages,
}: {
  href?: string;
  children: ReactNode;
  currentOrgId: string;
  projectId: string;
  pages: WikiPageSummaryDto[];
}) {
  const router = useRouter();
  if (!href) return <span>{children}</span>;

  let wikiPageId: string | null = null;
  let matchedProjectId = "";
  if (href.startsWith("wiki://")) {
    wikiPageId = href.replace("wiki://", "");
    const page = pages.find((p) => p.id === wikiPageId);
    if (page) matchedProjectId = page.projectId || "";
  } else {
    const wikiMatch = href.match(
      /\/orgs\/([^/]+)\/projects\/([^/]+)\/wiki\/([^/]+)/,
    );
    if (wikiMatch) {
      const [, matchedOrgId, projId, pageId] = wikiMatch;
      if (matchedOrgId !== currentOrgId) {
        return <DisabledLink>{children}</DisabledLink>;
      }
      wikiPageId = pageId;
      matchedProjectId = projId;
    }
  }

  if (wikiPageId) {
    const exists = pages.some((p) => p.id === wikiPageId);
    const realHref = matchedProjectId
      ? `/orgs/${currentOrgId}/projects/${matchedProjectId}/wiki/${wikiPageId}`
      : href;

    const handleClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      if (!exists) {
        alert(`Wiki page does not exist: ${wikiPageId}`);
        return;
      }

      const targetUrl = matchedProjectId
        ? `/orgs/${currentOrgId}/projects/${matchedProjectId}/wiki/${wikiPageId}`
        : `/orgs/${currentOrgId}/projects/${projectId}/wiki/${wikiPageId}`;

      router.push(targetUrl);
      window.dispatchEvent(
        new CustomEvent("kanban_open_wiki_page", { detail: wikiPageId }),
      );
    };

    return (
      <a
        href={realHref}
        onClick={handleClick}
        className="text-blue-600 hover:underline cursor-pointer"
      >
        {children}
      </a>
    );
  }

  let taskId: string | null = null;
  let taskProjectId = "";
  if (href.startsWith("task://")) {
    taskId = href.replace("task://", "");
  } else {
    const taskMatch = href.match(
      /\/orgs\/([^/]+)\/projects\/([^/]+)\/tasks\/([^/]+)/,
    );
    if (taskMatch) {
      const [, matchedOrgId, projId, tid] = taskMatch;
      if (matchedOrgId !== currentOrgId) {
        return <DisabledLink>{children}</DisabledLink>;
      }
      taskId = tid;
      taskProjectId = projId;
    }
  }

  if (taskId) {
    const realHref = taskProjectId
      ? `/orgs/${currentOrgId}/projects/${taskProjectId}?taskId=${taskId}`
      : href;

    const handleClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      window.dispatchEvent(
        new CustomEvent("kanban_tab_changed", { detail: "board" }),
      );
      window.dispatchEvent(
        new CustomEvent("kanban_open_task", { detail: taskId }),
      );
    };

    return (
      <a
        href={realHref}
        onClick={handleClick}
        className="text-blue-600 hover:underline cursor-pointer"
      >
        {children}
      </a>
    );
  }

  if (href.startsWith("http")) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer">
        {children}
      </a>
    );
  }

  return <a href={href}>{children}</a>;
}
