"use client";

import { useEffect, useRef, useState } from "react";
import type { TaskDto, WikiPageSummaryDto } from "@kanban/shared";
import { searchTasksInOrgAction } from "@/actions/tasks";
import { LinkModalHeader } from "./link-modal/LinkModalHeader";
import { LinkUrlInput } from "./link-modal/LinkUrlInput";
import { SearchField } from "./link-modal/SearchField";
import { TaskResults } from "./link-modal/TaskResults";
import { WikiResults } from "./link-modal/WikiResults";

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
    if (!isOpen) return;
    setSearch("");
    setUrl("https://");
    setTasks([]);
    setTimeout(() => inputRef.current?.focus(), 100);
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
        if (res.tasks) setTasks(res.tasks);
      } catch (e) {
        console.error("Task search failed", e);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search, type, orgId]);

  if (!isOpen) return null;

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
        <LinkModalHeader type={type} />

        <div className="p-6 space-y-4">
          {type === "link" ? (
            <LinkUrlInput
              inputRef={inputRef}
              url={url}
              onUrlChange={setUrl}
              onSelect={onSelect}
              onClose={onClose}
            />
          ) : (
            <div className="space-y-3">
              <SearchField
                inputRef={inputRef}
                type={type}
                search={search}
                onSearchChange={setSearch}
                onClose={onClose}
              />
              <div className="max-h-60 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                {type === "wiki" ? (
                  <WikiResults
                    pages={pages}
                    search={search}
                    onSelect={onSelect}
                  />
                ) : (
                  <TaskResults
                    tasks={tasks}
                    search={search}
                    isSearching={isSearching}
                    onSelect={onSelect}
                  />
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
