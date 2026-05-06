"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { WikiPageDto } from "@kanban/shared";
import { getWikiCached } from "./cache";

export function WikiLink({
  pageId,
  children,
}: {
  pageId: string;
  children: ReactNode;
}) {
  const [page, setPage] = useState<WikiPageDto | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!pageId) return;
    void getWikiCached(pageId).then((res) => {
      if (res && res.page) setPage(res.page);
      else if (res && res.error) setError(true);
    });
  }, [pageId]);

  return (
    <button
      type="button"
      disabled={error}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(
          new CustomEvent("kanban_tab_changed", { detail: "wiki" }),
        );
        window.dispatchEvent(
          new CustomEvent("kanban_open_wiki_page", { detail: pageId }),
        );
      }}
      className={`inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[13px] font-medium transition-colors border ${
        error
          ? "bg-red-50 border-red-100 text-red-500 cursor-not-allowed"
          : "bg-purple-50 hover:bg-purple-100 border-purple-100 text-purple-700"
      }`}
    >
      <span className="text-[10px] opacity-70 italic font-serif">W</span>
      {error ? (
        <span className="flex items-center gap-1 uppercase text-[10px] font-bold">
          <s>{children}</s>
          <span className="text-[10px] font-bold text-red-600">NOT FOUND</span>
        </span>
      ) : (
        page?.title || children
      )}
    </button>
  );
}
