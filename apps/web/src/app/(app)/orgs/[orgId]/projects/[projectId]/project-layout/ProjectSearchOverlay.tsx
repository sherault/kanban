import type { TaskDto, WikiPageSummaryDto } from "@kanban/shared";
import type { ReactNode } from "react";
import { CloseIcon, NoResults, ResultIcon } from "./ProjectSearchBits";
import { SearchIcon } from "./ProjectSearchFooter";

export function ProjectSearchOverlay({
  searchQuery,
  filteredPages,
  taskResults,
  isSearchingTasks,
  orgId,
  projectId,
  onClear,
  onOpenWiki,
  onOpenTask,
}: {
  searchQuery: string;
  filteredPages: WikiPageSummaryDto[];
  taskResults: Array<TaskDto & { projectName: string }>;
  isSearchingTasks: boolean;
  orgId: string;
  projectId: string;
  onClear: () => void;
  onOpenWiki: (url: string) => void;
  onOpenTask: (taskId: string) => void;
}) {
  if (!searchQuery) return null;
  const hasNoResults =
    filteredPages.length === 0 && taskResults.length === 0 && !isSearchingTasks;

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 w-full max-w-xl bg-white border border-gray-200 rounded-xl shadow-2xl z-50 overflow-hidden">
      <div className="p-3 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
        <div className="flex items-center gap-2 text-gray-400">
          <SearchIcon className="w-3.5 h-3.5" />
          <span className="text-[10px] font-bold uppercase tracking-wider">
            Search Results
          </span>
        </div>
        <button
          onClick={onClear}
          className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-200 rounded-md transition-colors"
        >
          <CloseIcon />
        </button>
      </div>
      <div className="max-h-[400px] overflow-y-auto p-2">
        {hasNoResults ? (
          <NoResults />
        ) : (
          <div className="space-y-4">
            {filteredPages.length > 0 && (
              <ResultGroup title="Wiki Pages">
                {filteredPages.map((page) => (
                  <WikiResult
                    key={page.id}
                    page={page}
                    onClick={() =>
                      onOpenWiki(
                        `/orgs/${orgId}/projects/${projectId}/wiki/${page.id}`,
                      )
                    }
                  />
                ))}
              </ResultGroup>
            )}
            {(taskResults.length > 0 || isSearchingTasks) && (
              <ResultGroup title="Tasks">
                {isSearchingTasks ? (
                  <div className="p-8 text-center">
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : (
                  taskResults.map((task) => (
                    <TaskResult
                      key={task.id}
                      task={task}
                      onClick={() => onOpenTask(task.id)}
                    />
                  ))
                )}
              </ResultGroup>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ResultGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <div className="px-3 py-1 text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
        <span className="w-1 h-1 rounded-full bg-gray-300" />
        {title}
      </div>
      {children}
    </div>
  );
}

function WikiResult({
  page,
  onClick,
}: {
  page: WikiPageSummaryDto;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 hover:bg-blue-50/50 rounded-lg flex items-start gap-3 transition-all group"
    >
      <ResultIcon
        tone="blue"
        path="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
      />
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold text-gray-900 group-hover:text-blue-700 transition-colors">
          {page.title}
        </span>
        <span className="text-xs text-gray-500 truncate mt-0.5">
          Wiki • {page.slug}
        </span>
      </div>
    </button>
  );
}

function TaskResult({
  task,
  onClick,
}: {
  task: TaskDto & { projectName: string };
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left p-3 hover:bg-emerald-50/50 rounded-lg flex items-start gap-3 transition-all group"
    >
      <ResultIcon
        tone="emerald"
        path="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
      />
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-semibold text-gray-900 group-hover:text-emerald-700 transition-colors">
          {task.title}
        </span>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-gray-500 truncate">
            Task • {task.projectName}
          </span>
          <span className="text-[10px] text-gray-300 font-mono">
            #{task.id.slice(0, 6)}
          </span>
        </div>
      </div>
    </button>
  );
}
