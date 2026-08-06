"use client";

import type { WikiPageSummaryDto } from "@kanban/shared";
import { MiniButton } from "./MiniButton";
import { objectProperty } from "./helpers";

export function FreshnessRow({
  page,
  reasons,
  disabled,
  onOpen,
  onTask,
}: {
  page: WikiPageSummaryDto;
  reasons: string[];
  disabled: boolean;
  onOpen: () => void;
  onTask: () => void;
}) {
  const freshness = objectProperty(page.properties?.["freshness"]);
  const hasReviewTask = typeof freshness["review_task_id"] === "string";

  return (
    <div className="rounded-md border border-gray-200 bg-white p-2">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full truncate text-left text-xs font-medium text-gray-800 hover:text-blue-700"
      >
        {page.title}
      </button>
      <div className="mt-1 truncate text-[10px] text-gray-500">
        {reasons.join(", ")}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <MiniButton title="Open page" onClick={onOpen} disabled={disabled}>
          Open
        </MiniButton>
        <MiniButton
          title={
            hasReviewTask
              ? "Freshness task already linked"
              : "Create review task"
          }
          onClick={onTask}
          disabled={disabled || hasReviewTask}
        >
          Review
        </MiniButton>
      </div>
    </div>
  );
}
