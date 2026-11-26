import type { TaskDto } from "@kanban/shared";

const FENCE = /^\s*(```|~~~)/;
const LEVEL_2_HEADING = /^##(?!#)\s/;

/**
 * Keeps only the requested level-2 Markdown sections of a description, in
 * their original order. A section runs from its `## ` heading to the next
 * level-2 heading or the end of the text; headings inside fenced code blocks
 * do not count. Requested titles are matched against the trimmed heading line.
 */
export function selectSections(
  description: string | null,
  sections: string[],
): { description: string; missingSections: string[] } {
  const wanted = new Set(sections.map((section) => section.trim()));
  const found = new Set<string>();
  const kept: string[] = [];
  let inFence = false;
  let keeping = false;

  for (const line of (description ?? "").split("\n")) {
    if (FENCE.test(line)) inFence = !inFence;
    else if (!inFence && LEVEL_2_HEADING.test(line)) {
      const heading = line.trim();
      keeping = wanted.has(heading);
      if (keeping) found.add(heading);
    }
    if (keeping) kept.push(line);
  }

  return {
    description: kept.join("\n").trim(),
    missingSections: [...wanted].filter((section) => !found.has(section)),
  };
}

const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/;

/**
 * Parses an ISO-8601 date or a stored SQLite `YYYY-MM-DD HH:MM:SS` timestamp
 * into epoch milliseconds. A value without a time zone is read as UTC, the zone
 * SQLite `datetime('now')` writes in. Returns NaN for anything else.
 */
export function parseTimestamp(value: string): number {
  if (!ISO_8601.test(value)) return Number.NaN;
  const withTime = value.length === 10 ? `${value}T00:00:00` : value;
  const iso = withTime.replace(" ", "T");
  const hasZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(iso);
  return Date.parse(hasZone ? iso : `${iso}Z`);
}

/** Task without its description, carrying the description length instead. */
export function withoutDescription(task: TaskDto) {
  const { description, ...rest } = task;
  return { ...rest, descriptionLength: description?.length ?? 0 };
}
