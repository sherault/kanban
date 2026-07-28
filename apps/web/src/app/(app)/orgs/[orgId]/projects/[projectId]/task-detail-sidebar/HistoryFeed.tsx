import type { TaskHistoryDto } from "@kanban/shared";

const SOURCE_LABELS: Record<NonNullable<TaskHistoryDto["source"]>, string> = {
  mcp: "via MCP",
  web: "via Web",
};

export function HistoryFeed({ history }: { history: TaskHistoryDto[] }) {
  if (!history || history.length === 0) {
    return <p className="text-xs text-gray-400">No history yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {history.map((entry) => (
        <li key={entry.id} className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">
            {entry.actor?.displayName || "System"}
          </span>
          {entry.source && (
            <span className="ml-1 text-gray-400">
              {SOURCE_LABELS[entry.source]}
            </span>
          )}
          {" changed "}
          <span className="font-medium">{entry.field}</span>
          {entry.oldValue !== null && (
            <>
              {" "}
              from{" "}
              <span className="line-through text-gray-400">
                {entry.oldValue}
              </span>
            </>
          )}
          {entry.newValue !== null && (
            <>
              {" "}
              to <span className="text-gray-700">{entry.newValue}</span>
            </>
          )}
          <span className="ml-1 text-gray-400">
            ·{" "}
            {new Date(entry.changedAt).toLocaleDateString("en", {
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </li>
      ))}
    </ul>
  );
}
