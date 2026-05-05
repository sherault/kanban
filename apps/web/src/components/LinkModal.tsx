"use client";

import React, { useState, useEffect, useRef } from "react";
import type { TaskDto, WikiPageSummaryDto } from "@kanban/shared";
import { searchTasksInOrgAction } from "@/actions/tasks";

export function LinkModal({
  isOpen,
  onClose,
  onSelect,
  type,
  pages,
  orgId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (href: string, title?: string) => void;
  type: "link" | "wiki" | "task";
  pages: WikiPageSummaryDto[];
  orgId: string;
}) {
  const [search, setSearch] = useState("");
  const [url, setUrl] = useState("https://");
  const [tasks, setTasks] = useState<Array<TaskDto & { projectName: string }>>(
    [],
  );
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearch("");
      setUrl("https://");
      setTasks([]);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  useEffect(() => {
    if (type !== "task" || search.length < 2) {
      setTasks([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await searchTasksInOrgAction(orgId, search);
        if (res.tasks) {
          setTasks(res.tasks);
        }
      } catch (e) {
        console.error("Task search failed", e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, type, orgId]);

  if (!isOpen) return null;

  const filteredPages =
    type === "wiki"
      ? pages.filter(
          (p) =>
            p.title.toLowerCase().includes(search.toLowerCase()) ||
            p.id.toLowerCase().includes(search.toLowerCase()),
        )
      : [];

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-[1000] p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden border border-gray-200 animate-in zoom-in-95 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-100 bg-gray-50/30">
          <h3 className="text-lg font-bold text-gray-900 tracking-tight">
            {type === "link"
              ? "Insert Link"
              : type === "wiki"
                ? "Link to Wiki Page"
                : "Link to Task"}
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            {type === "link"
              ? "Enter a URL to link to external content."
              : "Search and select an internal item to link."}
          </p>
        </div>

        <div className="p-6 space-y-4">
          {type === "link" ? (
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                URL
              </label>
              <input
                ref={inputRef}
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onSelect(url);
                  if (e.key === "Escape") onClose();
                }}
                className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                placeholder="https://example.com"
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Escape") onClose();
                  }}
                  className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder={
                    type === "wiki" ? "Search wiki pages..." : "Search tasks..."
                  }
                />
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {type === "wiki" &&
                  filteredPages.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => onSelect(`wiki:${p.id}`, p.title)}
                      className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-50 group transition-all"
                    >
                      <div className="font-medium text-sm text-gray-900 group-hover:text-blue-700">
                        {p.title}
                      </div>
                      <div className="text-[10px] text-gray-500 font-mono mt-0.5">
                        {p.slug}
                      </div>
                    </button>
                  ))}

                {type === "task" && (
                  <>
                    {isSearching ? (
                      <div className="py-8 text-center text-gray-400">
                        <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                        <span className="text-xs">Searching tasks...</span>
                      </div>
                    ) : tasks.length > 0 ? (
                      tasks.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => onSelect(`task:${t.id}`, t.title)}
                          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-50 group transition-all"
                        >
                          <div className="font-medium text-sm text-gray-900 group-hover:text-blue-700 truncate">
                            {t.title}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[10px] text-gray-400 font-mono">
                              #{t.id.slice(0, 6)}
                            </span>
                            {t.projectName && (
                              <span className="text-[10px] px-1 bg-gray-100 text-gray-400 rounded uppercase font-bold tracking-tighter">
                                {t.projectName}
                              </span>
                            )}
                          </div>
                        </button>
                      ))
                    ) : search.length >= 2 ? (
                      <div className="py-8 text-center text-gray-400 text-xs">
                        No tasks found for "{search}"
                      </div>
                    ) : (
                      <div className="py-8 text-center text-gray-400 text-xs">
                        Type at least 2 characters to search...
                      </div>
                    )}
                  </>
                )}

                {type === "wiki" && filteredPages.length === 0 && (
                  <div className="py-8 text-center text-gray-400 text-xs">
                    {search ? "No pages found" : "No wiki pages yet"}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-200 rounded-xl transition-colors"
          >
            Cancel
          </button>
          {type === "link" && (
            <button
              onClick={() => onSelect(url)}
              className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-sm transition-all"
            >
              Insert
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
