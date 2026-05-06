import { format } from "date-fns";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import type { WikiHistoryDto } from "@kanban/shared";

export function WikiHistoryDiff({
  history,
  selectedVersionIndex,
}: {
  history: WikiHistoryDto[];
  selectedVersionIndex: number;
}) {
  const oldVersion = history[selectedVersionIndex + 1];
  const newVersion = history[selectedVersionIndex];
  const oldContent = oldVersion
    ? `# ${oldVersion.title}\n\n${oldVersion.content}`
    : "";
  const newContent = newVersion
    ? `# ${newVersion.title}\n\n${newVersion.content}`
    : "";

  if (history.length === 0 || !newVersion) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-4">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center">
          <svg
            className="w-8 h-8 opacity-20"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <p className="text-sm">No revisions found for this page.</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between px-4 py-2 bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-6">
          <div className="flex flex-col">
            <span className="text-[10px] text-gray-400 font-bold uppercase">
              Comparing
            </span>
            <span className="text-xs font-semibold text-gray-700">
              {oldVersion
                ? `v${history.length - (selectedVersionIndex + 1)}`
                : "None"}
              <span className="mx-2 text-gray-300">→</span>
              v${history.length - selectedVersionIndex}
            </span>
          </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-xl overflow-hidden shadow-xl bg-white">
        <ReactDiffViewer
          oldValue={oldContent}
          newValue={newContent}
          splitView={true}
          compareMethod={DiffMethod.WORDS}
          leftTitle={
            oldVersion
              ? `${oldVersion.changedByName || "Author"} (${format(new Date(oldVersion.createdAt), "HH:mm")})`
              : "Initial"
          }
          rightTitle={`${newVersion.changedByName || "Author"} (${format(new Date(newVersion.createdAt), "HH:mm")})`}
          styles={{
            variables: {
              light: {
                diffViewerBackground: "#fff",
                addedBackground: "#ecfdf5",
                addedColor: "#065f46",
                removedBackground: "#fef2f2",
                removedColor: "#991b1b",
                wordAddedBackground: "#d1fae5",
                wordRemovedBackground: "#fee2e2",
              },
            },
            contentText: {
              fontSize: "13px",
              fontFamily:
                'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
              lineHeight: "1.7",
            },
            titleBlock: {
              background: "#f9fafb",
              padding: "12px 16px",
              fontSize: "12px",
              fontWeight: "bold",
              color: "#4b5563",
              borderBottom: "1px solid #e5e7eb",
            },
          }}
        />
      </div>
    </div>
  );
}
