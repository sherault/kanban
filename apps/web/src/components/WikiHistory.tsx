"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { getClientAccessToken } from "@/lib/auth-client";
import type { WikiHistoryDto, WikiPageDto } from "@kanban/shared";
import ReactDiffViewer, { DiffMethod } from "react-diff-viewer-continued";
import { format } from "date-fns";

interface Props {
  pageId: string;
  currentPage: WikiPageDto | null;
  onClose: () => void;
}

export function WikiHistory({ pageId, onClose }: Props) {
  const [history, setHistory] = useState<WikiHistoryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number>(0);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const token = await getClientAccessToken();
        if (!token) return;
        const { data } = await api.wiki.getHistory(token, pageId);
        setHistory(data);
      } catch (e) {
        console.error("Failed to fetch history", e);
      } finally {
        setIsLoading(false);
      }
    }
    void fetchHistory();
  }, [pageId]);

  const oldVersion = history[selectedVersionIndex + 1];
  const newVersion = history[selectedVersionIndex];

  const oldContent = oldVersion
    ? `# ${oldVersion.title}\n\n${oldVersion.content}`
    : "";
  const newContent = newVersion
    ? `# ${newVersion.title}\n\n${newVersion.content}`
    : "";

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
      <div className="flex-none h-16 border-b border-gray-200 px-6 flex items-center justify-between bg-white shadow-sm">
        <div className="flex flex-col">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">Version History</h2>
            <span className="px-2 py-0.5 text-[10px] font-mono bg-gray-100 text-gray-500 rounded border border-gray-200 uppercase tracking-tighter">
              ID: {pageId}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Compare edits and recover previous versions
          </p>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 rounded-full transition-all group"
        >
          <svg
            className="w-6 h-6 text-gray-400 group-hover:text-gray-600"
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

      <div className="flex-1 flex overflow-hidden">
        {/* Versions List */}
        <div className="w-80 border-r border-gray-200 flex flex-col bg-gray-50/20">
          <div className="p-4 border-b border-gray-100 flex items-center justify-between bg-white/50">
            <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">
              Revisions
            </span>
            <span className="text-[10px] text-gray-400 font-medium bg-gray-100 px-1.5 py-0.5 rounded">
              {history.length} total
            </span>
          </div>
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="p-12 flex flex-col items-center justify-center text-gray-400 space-y-3">
                <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm italic">Retrieving history...</span>
              </div>
            ) : history.length === 0 ? (
              <div className="p-12 text-center text-gray-400 text-sm italic">
                No version history found.
              </div>
            ) : (
              history.map((version, idx) => (
                <button
                  key={version.id}
                  onClick={() => setSelectedVersionIndex(idx)}
                  className={`w-full text-left p-4 border-b border-gray-100 transition-all hover:bg-white relative group ${
                    selectedVersionIndex === idx
                      ? "bg-white border-l-4 border-l-blue-500 shadow-sm z-10"
                      : "opacity-70 hover:opacity-100"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        idx === 0
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-600"
                      }`}
                    >
                      {idx === 0 ? "Current" : `v${history.length - idx}`}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {format(new Date(version.createdAt), "MMM d, HH:mm:ss")}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-gray-800 line-clamp-1 mb-1">
                    {version.title || "Untitled"}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center text-[8px] text-white font-bold uppercase">
                      {(version.changedByName || "U")[0]}
                    </div>
                    <span className="text-xs font-medium text-gray-500 truncate">
                      {version.changedByName || "Unknown Author"}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Diff Viewer */}
        <div className="flex-1 overflow-y-auto bg-gray-50/30 p-8">
          {history.length > 0 ? (
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
          ) : (
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
          )}
        </div>
      </div>
    </div>
  );
}
