"use client";

import { useRouter } from "next/navigation";
import type { WikiPageSummaryDto } from "@kanban/shared";
import type { MouseEvent, ReactNode } from "react";
import { getTaskByIdAction } from "@/actions/tasks";
import { parseSchemeId } from "./linkScheme";

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
  pages,
}: {
  href?: string;
  children: ReactNode;
  currentOrgId: string;
  pages: WikiPageSummaryDto[];
}) {
  const router = useRouter();
  if (!href) return <span>{children}</span>;

  // Three shapes reach here: the wiki: scheme, the current org-scoped URL,
  // and the legacy project-scoped URL still stored in old page revisions.
  let wikiPageId: string | null = parseSchemeId(href, "wiki");
  if (!wikiPageId) {
    const legacyMatch = href.match(
      /\/orgs\/([^/]+)\/projects\/([^/]+)\/wiki\/([^/?#]+)/,
    );
    const orgMatch = href.match(/\/orgs\/([^/]+)\/wiki\/([^/?#]+)/);
    if (legacyMatch) {
      const [, matchedOrgId, , pageId] = legacyMatch;
      if (matchedOrgId !== currentOrgId) {
        return <DisabledLink>{children}</DisabledLink>;
      }
      wikiPageId = pageId ?? null;
    } else if (orgMatch) {
      const [, matchedOrgId, pageId] = orgMatch;
      if (matchedOrgId !== currentOrgId) {
        return <DisabledLink>{children}</DisabledLink>;
      }
      wikiPageId = pageId ?? null;
    }
  }

  if (wikiPageId) {
    const exists = pages.some((p) => p.id === wikiPageId);
    const targetUrl = `/orgs/${currentOrgId}/wiki/${wikiPageId}`;

    const handleClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (!exists) {
        alert(`Wiki page does not exist: ${wikiPageId}`);
        return;
      }

      router.push(targetUrl);
      window.dispatchEvent(
        new CustomEvent("kanban_open_wiki_page", { detail: wikiPageId }),
      );
    };

    return (
      <a
        href={targetUrl}
        onClick={handleClick}
        className="text-blue-600 hover:underline cursor-pointer"
      >
        {children}
      </a>
    );
  }

  let taskId: string | null = parseSchemeId(href, "task");
  let taskProjectId = "";
  if (!taskId) {
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
    // The board is a different route now, so opening a task means navigating:
    // the window event alone would be dispatched into a page with no board.
    const realHref = taskProjectId
      ? `/orgs/${currentOrgId}/projects/${taskProjectId}?taskId=${taskId}`
      : href;

    const handleClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (taskProjectId) {
        router.push(realHref);
        return;
      }
      // The task: scheme carries no project, and the wiki is org-scoped now,
      // so the owning project has to be resolved before we can open the board.
      void getTaskByIdAction(taskId).then((res) => {
        if (!res.task) {
          alert(`Task does not exist: ${taskId}`);
          return;
        }
        router.push(
          `/orgs/${currentOrgId}/projects/${res.task.projectId}?taskId=${taskId}`,
        );
      });
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
