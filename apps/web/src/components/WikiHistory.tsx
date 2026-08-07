"use client";

import { useCallback, useRef, useState } from "react";
import { getWikiHistoryAction } from "@/actions/wiki";
import type { WikiHistoryDto } from "@kanban/shared";
import { WikiHistoryDiffModal } from "./wiki-history/WikiHistoryDiffModal";
import { WikiHistoryHeader } from "./wiki-history/WikiHistoryHeader";
import { WikiHistoryVersionList } from "./wiki-history/WikiHistoryVersionList";

const PAGE_SIZE = 20;

interface Props {
  pageId: string;
  currentTitle: string;
  currentContent: string;
  onClose: () => void;
}

export function WikiHistory({
  pageId,
  currentTitle,
  currentContent,
  onClose,
}: Props) {
  const [versions, setVersions] = useState<WikiHistoryDto[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<WikiHistoryDto | null>(
    null,
  );

  // Guards against overlapping loads triggered by the scroll observer.
  const isLoadingRef = useRef(false);
  const offsetRef = useRef(0);

  const loadMore = useCallback(async () => {
    if (isLoadingRef.current) return;
    isLoadingRef.current = true;
    setIsLoading(true);

    const result = await getWikiHistoryAction(
      pageId,
      PAGE_SIZE,
      offsetRef.current,
    );

    if (result.error || !result.history) {
      setError(result.error ?? "Failed to load history");
      setHasMore(false);
    } else {
      const { items, hasMore: more } = result.history;
      offsetRef.current += items.length;
      setVersions((prev) => [...prev, ...items]);
      setHasMore(more);
    }

    setIsLoading(false);
    isLoadingRef.current = false;
  }, [pageId]);

  // The first page is loaded by the list's scroll sentinel, which is visible
  // as soon as the panel opens.

  return (
    <div className="fixed inset-0 z-[100] flex justify-end bg-black/20">
      <button
        type="button"
        aria-label="Close history"
        className="flex-1 cursor-default"
        onClick={onClose}
      />
      <div className="w-96 h-full bg-white border-l border-gray-200 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200">
        <WikiHistoryHeader count={versions.length} onClose={onClose} />
        <WikiHistoryVersionList
          versions={versions}
          isLoading={isLoading}
          hasMore={hasMore}
          error={error}
          onLoadMore={loadMore}
          onSelectVersion={setSelectedVersion}
        />
      </div>

      {selectedVersion && (
        <WikiHistoryDiffModal
          version={selectedVersion}
          currentTitle={currentTitle}
          currentContent={currentContent}
          onClose={() => setSelectedVersion(null)}
        />
      )}
    </div>
  );
}
