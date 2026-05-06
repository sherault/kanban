import type { TaskDto, WikiPageSummaryDto } from "@kanban/shared";

export function getTooltipLabel({
  href,
  pages,
  tasks,
  taskCache,
}: {
  href: string;
  pages: WikiPageSummaryDto[];
  tasks: TaskDto[];
  taskCache: Record<string, string>;
}): { label: string; isError: boolean } {
  if (href.startsWith("wiki://")) {
    const id = href.replace("wiki://", "");
    const page = pages.find((p) => p.id === id);
    return page
      ? { label: `Wiki: ${page.title}`, isError: false }
      : { label: "Error: Wiki page not found", isError: true };
  }

  if (href.startsWith("task://")) {
    const id = href.replace("task://", "");
    const task = tasks.find((t) => t.id === id);
    if (task) return { label: `Task: ${task.title}`, isError: false };
    if (!taskCache[id]) {
      return { label: "Task: Loading title...", isError: false };
    }
    if (taskCache[id].startsWith("Unknown")) {
      return { label: "Error: Task not found", isError: true };
    }
    return { label: `Task: ${taskCache[id]}`, isError: false };
  }

  return { label: href, isError: false };
}

export function LinkTooltip({
  href,
  rect,
  pages,
  tasks,
  taskCache,
}: {
  href: string;
  rect: Partial<DOMRect>;
  pages: WikiPageSummaryDto[];
  tasks: TaskDto[];
  taskCache: Record<string, string>;
}) {
  const { label, isError } = getTooltipLabel({
    href,
    pages,
    tasks,
    taskCache,
  });

  return (
    <div
      className={`absolute z-50 text-white text-[10px] px-2 py-1 rounded shadow-lg pointer-events-none whitespace-nowrap animate-in fade-in zoom-in duration-200 border ${
        isError
          ? "bg-red-600 border-red-400 font-bold"
          : "bg-gray-900 border-gray-700"
      }`}
      style={{
        top: (rect.bottom || 0) + 5,
        left: Math.max(10, rect.left || 0),
      }}
    >
      {label}
    </div>
  );
}
