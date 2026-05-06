"use client";

import { ConflictModal } from "./task-detail-sidebar/ConflictModal";
import { TaskDetailBody } from "./task-detail-sidebar/TaskDetailBody";
import { TaskDetailFooter } from "./task-detail-sidebar/TaskDetailFooter";
import { TaskDetailHeader } from "./task-detail-sidebar/TaskDetailHeader";
import { useTaskDetailController } from "./task-detail-sidebar/useTaskDetailController";
import type { TaskDetailSidebarProps } from "./task-detail-sidebar/types";

export function TaskDetailSidebar(props: TaskDetailSidebarProps) {
  const {
    orgMembers,
    projectId,
    orgId,
    currentOpenTaskIds,
    objectives,
    allTags,
    onClose,
    onCloseAll,
    onOpenRelatedTask,
    showCloseAll,
    isActive,
    isExpanded,
    onActivate,
    onFold,
    onOpenAsComparison,
    width,
  } = props;
  const controller = useTaskDetailController(props);
  const { task } = controller;

  return (
    <>
      {controller.activeConflict && (
        <ConflictModal
          field={controller.activeConflict.field}
          conflict={controller.activeConflict.info}
          onResolve={controller.activeConflict.resolve}
        />
      )}

      {!task ? null : (
        <aside
          data-sidebar="true"
          style={{ width: isExpanded ? width : 48 }}
          className={`border-l border-gray-200 bg-white flex flex-col h-full overflow-hidden shrink-0 relative transition-opacity duration-300 ${
            !isActive ? "opacity-95" : "opacity-100"
          }`}
        >
          <TaskDetailHeader
            task={task}
            isExpanded={isExpanded}
            isPending={controller.isPending}
            showCloseAll={showCloseAll}
            onActivate={onActivate}
            onOpenAsComparison={onOpenAsComparison}
            onResizeMouseDown={controller.onResizeMouseDown}
            onCloseAll={onCloseAll}
            onFold={onFold}
            onClose={onClose}
          />
          <TaskDetailBody
            task={task}
            loading={controller.loading}
            saveError={controller.saveError}
            orgId={orgId}
            projectId={projectId}
            currentOpenTaskIds={currentOpenTaskIds}
            orgMembers={orgMembers}
            objectives={objectives}
            allTags={allTags}
            fields={controller.fields}
            linkedTasks={controller.linkedTasks}
            loadingLinks={controller.loadingLinks}
            history={controller.history}
            showHistory={controller.showHistory}
            save={controller.save}
            setShowHistory={controller.setShowHistory}
            onOpenRelatedTask={onOpenRelatedTask}
            actions={controller}
          />
          <TaskDetailFooter
            confirmDelete={controller.confirmDelete}
            isPending={controller.isPending}
            onCancelDelete={() => controller.setConfirmDelete(false)}
            onDelete={controller.handleDelete}
          />
        </aside>
      )}
    </>
  );
}
