"use client";

import { useEffect, useState } from "react";
import { getWikiHistoryAction } from "@/actions/wiki";
import type { WikiHistoryDto, WikiPageDto } from "@kanban/shared";
import { WikiHistoryDiff } from "./wiki-history/WikiHistoryDiff";
import { WikiHistoryHeader } from "./wiki-history/WikiHistoryHeader";
import { WikiHistoryVersionList } from "./wiki-history/WikiHistoryVersionList";

interface Props {
  pageId: string;
  currentPage: WikiPageDto | null;
  onClose: () => void;
}

export function WikiHistory({ pageId, onClose }: Props) {
  const [history, setHistory] = useState<WikiHistoryDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedVersionIndex, setSelectedVersionIndex] = useState(0);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const result = await getWikiHistoryAction(pageId);
        if (result.history) {
          setHistory(result.history);
        } else if (result.error) {
          console.error("Failed to fetch history", result.error);
        }
      } catch (e) {
        console.error("Failed to fetch history", e);
      } finally {
        setIsLoading(false);
      }
    }
    void fetchHistory();
  }, [pageId]);

  return (
    <div className="fixed inset-0 z-[100] bg-white flex flex-col animate-in fade-in slide-in-from-bottom-4 duration-200">
      <WikiHistoryHeader pageId={pageId} onClose={onClose} />
      <div className="flex-1 flex overflow-hidden">
        <WikiHistoryVersionList
          history={history}
          isLoading={isLoading}
          selectedVersionIndex={selectedVersionIndex}
          onSelectVersion={setSelectedVersionIndex}
        />
        <div className="flex-1 overflow-y-auto bg-gray-50/30 p-8">
          <WikiHistoryDiff
            history={history}
            selectedVersionIndex={selectedVersionIndex}
          />
        </div>
      </div>
    </div>
  );
}
