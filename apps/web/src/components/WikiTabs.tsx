"use client";

import { useMemo } from "react";
import { useWiki } from "@/context/WikiContext";

interface Props {
  activePageId: string | null;
  openPageIds: string[];
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
}

export function WikiTabs({
  activePageId,
  openPageIds,
  onTabClick,
  onTabClose,
}: Props) {
  const { pages } = useWiki();

  const pageTitles = useMemo(() => {
    const titles: Record<string, string> = {};
    pages.forEach((p) => {
      titles[p.id] = p.title;
    });
    return titles;
  }, [pages]);

  return (
    <div className="flex-none h-10 bg-gray-50 border-b border-gray-200 flex items-end overflow-x-auto">
      {openPageIds.map((id) => (
        <div
          key={id}
          className={`flex items-center gap-2 px-3 py-1.5 text-xs border-r border-gray-200 cursor-pointer transition-colors shrink-0 ${
            activePageId === id
              ? "bg-white border-t-2 border-t-blue-500 font-medium text-gray-900"
              : "text-gray-500 hover:bg-gray-100"
          }`}
          onClick={() => onTabClick(id)}
        >
          <span className="truncate max-w-[120px]">
            {pageTitles[id] || `Page ${id.slice(0, 4)}...`}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onTabClose(id);
            }}
            className="hover:text-red-500"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
