"use client";

import { useEffect, useRef } from "react";
import type { TaskDto } from "@kanban/shared";
import { WikiTabs } from "@/components/WikiTabs";
import { useWiki } from "@/context/WikiContext";
import { readWikiTabs, writeWikiTabs } from "@/lib/wikiTabsStorage";
import dynamic from "next/dynamic";

import { useRouter, useParams, usePathname } from "next/navigation";

const WikiEditor = dynamic(
  () => import("@/components/WikiEditor").then((m) => m.WikiEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex flex-col items-center justify-center space-y-4 bg-gray-50/30 h-full">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-medium">Loading editor...</p>
      </div>
    ),
  },
);

interface Props {
  orgId: string;
  projectId: string;
  tasks?: TaskDto[];
}

export function WikiClient({ orgId, projectId, tasks }: Props) {
  const router = useRouter();
  const {
    pages,
    splits,
    setSplits,
    isSplit,
    setIsSplit,
    activeSplitIndex,
    setActiveSplitIndex,
    openPageInSplit,
    closePageInSplit,
  } = useWiki();

  const params = useParams();
  const wikiParam = params.wikiPageId;
  const urlWikiPageId = wikiParam as string | undefined;

  // This tree stays mounted on the board tab (hidden via CSS), so URL syncing
  // has to be gated on the route. Read it from the pathname rather than the
  // layout's `activeTab` state: that state is set in a parent effect, which
  // runs after this component's effects, so it still says "wiki" on the render
  // that lands on the board — long enough to push us back to the wiki.
  const pathname = usePathname();
  const isWikiRoute = pathname.startsWith(
    `/orgs/${orgId}/projects/${projectId}/wiki`,
  );

  const activeSplitRef = useRef(activeSplitIndex);
  useEffect(() => {
    activeSplitRef.current = activeSplitIndex;
  }, [activeSplitIndex]);

  // Open tabs only live in context, so a reload would lose everything but the
  // page in the URL. Restore the persisted set once, before any other effect
  // reads or pushes the URL. Runs client-side only (this tree renders after the
  // layout has hydrated).
  const isRestoredRef = useRef(false);
  const skipNextWriteRef = useRef(false);
  const restoredPageIdsRef = useRef<string[] | null>(null);
  useEffect(() => {
    if (isRestoredRef.current) return;
    isRestoredRef.current = true;
    const stored = readWikiTabs(orgId);
    if (stored) {
      // The write effect below runs in this same commit, when `splits` is still
      // the pre-restore default — let it skip that stale pass.
      skipNextWriteRef.current = true;
      restoredPageIdsRef.current = stored.splits.flatMap((s) => s.openPageIds);
      const targetIndex = stored.activeSplitIndex;
      setSplits(
        stored.splits.map((split, idx) => {
          if (idx !== targetIndex || !urlWikiPageId) return split;
          // The URL wins over the persisted active page on reload.
          return {
            activePageId: urlWikiPageId,
            openPageIds: split.openPageIds.includes(urlWikiPageId)
              ? split.openPageIds
              : [...split.openPageIds, urlWikiPageId],
          };
        }),
      );
      setIsSplit(stored.isSplit);
      setActiveSplitIndex(targetIndex);
      activeSplitRef.current = targetIndex;
    }
  }, [orgId, urlWikiPageId, setSplits, setIsSplit, setActiveSplitIndex]);

  useEffect(() => {
    if (!isRestoredRef.current) return;
    if (skipNextWriteRef.current) {
      skipNextWriteRef.current = false;
      return;
    }
    writeWikiTabs(orgId, { splits, isSplit, activeSplitIndex });
  }, [orgId, splits, isSplit, activeSplitIndex]);

  // Drop restored tabs whose page no longer exists. Limited to the restored ids
  // so a freshly created page can't be pruned before it lands in `pages`.
  useEffect(() => {
    const restoredIds = restoredPageIdsRef.current;
    if (!restoredIds || pages.length === 0) return;
    restoredPageIdsRef.current = null;
    const known = new Set(pages.map((p) => p.id));
    const stale = restoredIds.filter((id) => !known.has(id));
    if (stale.length === 0) return;
    setSplits((prev) =>
      prev.map((split) => {
        const openPageIds = split.openPageIds.filter(
          (id) => !stale.includes(id),
        );
        if (openPageIds.length === split.openPageIds.length) return split;
        const activePageId =
          split.activePageId && stale.includes(split.activePageId)
            ? openPageIds[openPageIds.length - 1] || null
            : split.activePageId;
        return { activePageId, openPageIds };
      }),
    );
  }, [pages, setSplits]);

  useEffect(() => {
    if (urlWikiPageId) {
      openPageInSplit(urlWikiPageId, activeSplitRef.current);
    }
  }, [urlWikiPageId, openPageInSplit]);

  // Keep the URL in sync with the focused split's active page. Doing this in an
  // effect (rather than pushing from click handlers) avoids stale reads of
  // activePageId when a click bubbles up from inside the editor.
  const focusedPageId = splits[activeSplitIndex]?.activePageId ?? null;
  useEffect(() => {
    // Restored tabs give us a focused page even on the board, so pushing here
    // unconditionally would bounce the board straight to the wiki.
    if (!isWikiRoute) return;
    if (!isRestoredRef.current) return;
    if (!focusedPageId || focusedPageId === urlWikiPageId) return;
    router.push(`/orgs/${orgId}/projects/${projectId}/wiki/${focusedPageId}`);
  }, [isWikiRoute, focusedPageId, urlWikiPageId, orgId, projectId, router]);

  useEffect(() => {
    const handleOpenPage = (e: Event) => {
      if (!(e instanceof CustomEvent) || typeof e.detail !== "string") return;
      openPageInSplit(e.detail, activeSplitIndex);
    };

    window.addEventListener("kanban_open_wiki_page", handleOpenPage);
    return () =>
      window.removeEventListener("kanban_open_wiki_page", handleOpenPage);
  }, [activeSplitIndex, openPageInSplit]);

  const toggleSplit = () => {
    if (isSplit) {
      // Merge second split into first
      setSplits((prev) => {
        const first = { ...prev[0] };
        const second = prev[1];
        if (second) {
          const uniqueIds = Array.from(
            new Set([...first.openPageIds, ...second.openPageIds]),
          );
          first.openPageIds = uniqueIds;
          first.activePageId = second.activePageId || first.activePageId;
        }
        return [first];
      });
      setIsSplit(false);
      setActiveSplitIndex(0);
    } else {
      setSplits((prev) => [...prev, { activePageId: null, openPageIds: [] }]);
      setIsSplit(true);
      setActiveSplitIndex(1);
    }
  };

  return (
    <div className="flex flex-col h-full bg-white overflow-hidden">
      <div className="flex-none h-12 border-b border-gray-200 px-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h2 className="text-sm font-semibold text-gray-700">Wiki</h2>
        </div>
        <button
          onClick={toggleSplit}
          className="text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1 transition-colors"
        >
          {isSplit ? "Unsplit" : "Split View"}
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {splits.map((split, idx) => (
          <div
            key={idx}
            className={`flex-1 flex flex-col min-w-0 border-l border-gray-200 first:border-l-0 ${
              activeSplitIndex === idx ? "bg-white" : "bg-gray-50/50"
            }`}
            onClick={() => setActiveSplitIndex(idx)}
          >
            <WikiTabs
              activePageId={split.activePageId}
              openPageIds={split.openPageIds}
              onTabClick={(id) => {
                setActiveSplitIndex(idx);
                openPageInSplit(id, idx);
              }}
              onTabClose={(id) => closePageInSplit(id, idx)}
            />
            <div className="flex-1 overflow-y-auto">
              {split.activePageId ? (
                <WikiEditor
                  key={split.activePageId}
                  pageId={split.activePageId}
                  orgId={orgId}
                  projectId={projectId}
                  tasks={tasks}
                />
              ) : (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm italic">
                  Select a page to view or edit
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
