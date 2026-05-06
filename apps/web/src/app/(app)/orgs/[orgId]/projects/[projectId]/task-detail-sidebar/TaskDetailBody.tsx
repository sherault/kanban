import type { MembershipDto, TaskDto, TaskHistoryDto } from "@kanban/shared";
import { LinkedTasksSection } from "./LinkedTasksSection";
import { TaskCoreFields } from "./TaskCoreFields";
import { TaskHistorySection } from "./TaskHistorySection";
import { TaskPeopleSection } from "./TaskPeopleSection";
import { TaskProjectContext } from "./TaskProjectContext";
import type { ConflictField, TaskUpdateBody } from "./types";

export function TaskDetailBody({
  task,
  loading,
  saveError,
  orgId,
  projectId,
  currentOpenTaskIds,
  orgMembers,
  objectives,
  allTags,
  fields,
  linkedTasks,
  loadingLinks,
  history,
  showHistory,
  save,
  setShowHistory,
  onOpenRelatedTask,
  actions,
}: {
  task: TaskDto;
  loading: boolean;
  saveError: string | null;
  orgId: string;
  projectId: string;
  currentOpenTaskIds: string[];
  orgMembers: MembershipDto[];
  objectives: string[];
  allTags: string[];
  fields: {
    titleField: ConflictField;
    descField: ConflictField;
    objField: ConflictField;
    subjectField: ConflictField;
  };
  linkedTasks: TaskDto[];
  loadingLinks: boolean;
  history: TaskHistoryDto[] | null;
  showHistory: boolean;
  save: (body: TaskUpdateBody) => void;
  setShowHistory: (show: boolean | ((show: boolean) => boolean)) => void;
  onOpenRelatedTask?: (taskId: string) => void;
  actions: {
    addLink: (taskId: string) => Promise<void>;
    removeLink: (taskId: string) => Promise<void>;
    handleTagAdd: (tag: string) => void;
    handleTagRemove: (tag: string) => void;
    handleWatcherAdd: (userId: string) => void;
    handleWatcherRemove: (userId: string) => void;
    handleAdvisorAdd: (userId: string) => void;
    handleAdvisorRemove: (userId: string) => void;
  };
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {saveError && (
        <div className="px-5 py-2 bg-red-50 border-b border-red-200 text-red-700 text-xs">
          {saveError}
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-400 space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium">Fetching task details...</p>
        </div>
      ) : (
        <div className="flex-1 p-5 space-y-5 overflow-y-auto">
          <TaskProjectContext
            task={task}
            orgId={orgId}
            projectId={projectId}
            currentOpenTaskIds={currentOpenTaskIds}
          />
          <TaskCoreFields
            task={task}
            fields={fields}
            objectives={objectives}
            allTags={allTags}
            save={save}
            onOpenRelatedTask={onOpenRelatedTask}
            onTagAdd={actions.handleTagAdd}
            onTagRemove={actions.handleTagRemove}
          />
          <LinkedTasksSection
            task={task}
            linkedTasks={linkedTasks}
            loadingLinks={loadingLinks}
            projectId={projectId}
            onOpenRelatedTask={onOpenRelatedTask}
            onAddLink={actions.addLink}
            onRemoveLink={actions.removeLink}
          />
          <TaskPeopleSection
            task={task}
            orgMembers={orgMembers}
            save={save}
            onWatcherAdd={actions.handleWatcherAdd}
            onWatcherRemove={actions.handleWatcherRemove}
            onAdvisorAdd={actions.handleAdvisorAdd}
            onAdvisorRemove={actions.handleAdvisorRemove}
          />
          <TaskHistorySection
            showHistory={showHistory}
            history={history}
            onToggle={() => setShowHistory((value) => !value)}
          />
        </div>
      )}
    </div>
  );
}
