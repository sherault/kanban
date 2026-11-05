import { z } from "zod";
import type { TaskDto } from "@kanban/shared";

export const COLUMN_VALUES = ["ideas", "todo", "doing", "done"] as const;

export function jsonText(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value) }],
  };
}

export function textResult(text: string, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    ...(isError ? { isError: true } : {}),
  };
}

export const verboseInput = z
  .boolean()
  .optional()
  .describe(
    "Return the full task object instead of the compact acknowledgement (default false)",
  );

export const COMPACT_ACK_GUIDANCE =
  "Returns a compact acknowledgement { id, projectId, column, title, tags, doer, validatorId, backgroundColor, updatedAt } without the description; pass verbose: true for the full task object, or call get_task to read it back.";

/**
 * Compact acknowledgement of a task write: identity and board-level fields
 * only, never the description or any other unbounded field.
 */
export function taskAck(task: TaskDto, extras: Record<string, unknown> = {}) {
  return {
    id: task.id,
    projectId: task.projectId,
    column: task.column,
    title: task.title,
    tags: task.tags,
    doer: task.doer
      ? { id: task.doer.id, displayName: task.doer.displayName }
      : null,
    validatorId: task.validator?.id ?? null,
    backgroundColor: task.backgroundColor,
    updatedAt: task.updatedAt,
    ...extras,
  };
}

/** Full task when `verbose`, compact acknowledgement otherwise. */
export function taskResult(
  task: TaskDto,
  verbose: boolean | undefined,
  extras: Record<string, unknown> = {},
) {
  return jsonText(verbose ? task : taskAck(task, extras));
}

const COMPARED_FIELDS: Record<string, (task: TaskDto) => unknown> = {
  title: (t) => t.title,
  description: (t) => t.description,
  objective: (t) => t.objective,
  startDate: (t) => t.startDate,
  endDate: (t) => t.endDate,
  backgroundColor: (t) => t.backgroundColor,
  globalSubject: (t) => t.globalSubject,
  doerId: (t) => t.doer?.id ?? null,
  validatorId: (t) => t.validator?.id ?? null,
  tags: (t) => t.tags.join("\n"),
};

/** Names of the fields whose value differs between two versions of a task. */
export function changedFields(
  before: TaskDto | undefined,
  after: TaskDto,
): string[] {
  if (!before) return [];
  return Object.entries(COMPARED_FIELDS)
    .filter(([, read]) => read(before) !== read(after))
    .map(([field]) => field);
}

/**
 * Heading the server stamped above an appended note: the last line before the
 * note body, which ends the description verbatim (trimmed).
 */
export function appendedNoteHeading(
  task: TaskDto,
  text: string,
): string | null {
  const note = text.trim();
  const description = task.description ?? "";
  if (!note || !description.endsWith(note)) return null;
  const before = description.slice(0, -note.length).replace(/\s+$/, "");
  const heading = before.slice(before.lastIndexOf("\n") + 1);
  return heading.startsWith("#### ") ? heading : null;
}
