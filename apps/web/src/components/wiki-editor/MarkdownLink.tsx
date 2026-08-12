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
  pages,
}: {
  href?: string;
  children: ReactNode;
  currentOrgId: string;
  pages: WikiPageSummaryDto[];
}) {
  const router = useRouter();
  if (!href) return <span>{children}</span>;

  // Three shapes reach here: the wiki:// scheme, the current org-scoped URL,
  // and the legacy project-scoped URL still stored in old page revisions.
  let wikiPageId: string | null = null;
  if (href.startsWith("wiki://")) {
    wikiPageId = href.replace("wiki://", "");
  } else {
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
    // The board is a different route now, so opening a task means navigating:
    // the window event alone would be dispatched into a page with no board.
    const realHref = taskProjectId
      ? `/orgs/${currentOrgId}/projects/${taskProjectId}?taskId=${taskId}`
      : href;

    const handleClick = (e: MouseEvent) => {
      if (e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      e.stopPropagation();
      if (!taskProjectId) return;
      router.push(realHref);
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
