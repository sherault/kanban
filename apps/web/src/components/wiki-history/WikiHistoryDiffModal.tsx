import type { ComponentProps } from "react";
import { format } from "date-fns";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import type { WikiHistoryDto } from "@kanban/shared";

function asDocument(title: string, content: string): string {
  return `# ${title}\n\n${content}`;
}

// `columnHeaders` (the wrapper around both title blocks) is honoured at runtime
// but missing from the library's style-override type, hence the assertion.
const diffStyles = {
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
  columnHeaders: {
    paddingBottom: "12px",
  },
} as ComponentProps<typeof ReactDiffViewer>["styles"];

export function WikiHistoryDiffModal({
  version,
  currentTitle,
  currentContent,
  onClose,
}: {
  version: WikiHistoryDto;
  currentTitle: string;
  currentContent: string;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[110] bg-black/50 flex items-center justify-center p-8"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-full flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex-none h-14 border-b border-gray-100 px-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-gray-900">
              {format(new Date(version.createdAt), "MMM d, yyyy HH:mm")}
            </h3>
            <span className="text-xs text-gray-400">
              {version.changedByName || "Unknown author"}
            </span>
            {version.source === "mcp" && (
              <span className="text-[9px] font-black uppercase tracking-widest text-violet-600 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded">
                MCP
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="Close diff"
            className="p-1.5 hover:bg-gray-100 rounded-full transition-all group"
          >
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-auto p-5">
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <ReactDiffViewer
              oldValue={asDocument(version.title, version.content)}
              newValue={asDocument(currentTitle, currentContent)}
              splitView={true}
              compareMethod={DiffMethod.WORDS}
              leftTitle="Selected version"
              rightTitle="Current version"
              styles={diffStyles}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
