"use client";

import type { WikiPageSummaryDto } from "@kanban/shared";
import { MiniButton } from "./MiniButton";
import { arrayProperty } from "./helpers";

export function InboxCaptureRow({
  page,
  disabled,
  onOpen,
  onTask,
  onDone,
}: {
  page: WikiPageSummaryDto;
  disabled: boolean;
  onOpen: () => void;
  onTask: () => void;
  onDone: () => void;
}) {
  const hasTask =
    arrayProperty(page.properties?.["related_task_ids"]).length > 0;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-2">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full truncate text-left text-xs font-medium text-gray-800 hover:text-blue-700"
      >
        {page.title}
      </button>
      <div className="mt-2 flex items-center gap-1">
        <MiniButton title="Open page" onClick={onOpen} disabled={disabled}>
          Open
        </MiniButton>
        <MiniButton
          title={hasTask ? "Triage task already linked" : "Create triage task"}
          onClick={onTask}
          disabled={disabled || hasTask}
        >
          Task
        </MiniButton>
        <MiniButton title="Mark triaged" onClick={onDone} disabled={disabled}>
          Done
        </MiniButton>
      </div>
    </div>
  );
}
