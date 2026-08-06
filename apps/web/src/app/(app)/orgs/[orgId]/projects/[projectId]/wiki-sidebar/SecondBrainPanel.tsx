"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WikiPageSummaryDto } from "@kanban/shared";
import {
  createFreshnessTaskForWikiPageAction,
  createSecondBrainCaptureAction,
  createTriageTaskForWikiPageAction,
  markWikiPageTriagedAction,
} from "@/actions/wiki";
import { FreshnessRow } from "./second-brain/FreshnessRow";
import { InboxCaptureRow } from "./second-brain/InboxCaptureRow";
import { useSecondBrainData } from "./second-brain/useSecondBrainData";

interface SecondBrainPanelProps {
  orgId: string;
  projectId: string;
  pages: WikiPageSummaryDto[];
  onRefresh: () => void;
}

type Notice = {
  tone: "error" | "success";
  text: string;
};

export function SecondBrainPanel({
  orgId,
  projectId,
  pages,
  onRefresh,
}: SecondBrainPanelProps) {
  const router = useRouter();
  const [isCaptureOpen, setIsCaptureOpen] = useState(false);
  const [captureTitle, setCaptureTitle] = useState("");
  const [captureContent, setCaptureContent] = useState("");
  const [notice, setNotice] = useState<Notice | null>(null);
  const [isPending, startTransition] = useTransition();

  const { inboxPage, inboxCaptures, freshnessPages } = useSecondBrainData(
    pages,
    projectId,
  );

  const openPage = (pageId: string) => {
    router.push(`/orgs/${orgId}/projects/${projectId}/wiki/${pageId}`);
    window.dispatchEvent(
      new CustomEvent("kanban_tab_changed", { detail: "wiki" }),
    );
    window.dispatchEvent(
      new CustomEvent("kanban_open_wiki_page", { detail: pageId }),
    );
  };

  const runAction = (
    action: () => Promise<{ error?: string; page?: WikiPageSummaryDto }>,
    success: string,
    pageId?: string,
  ) => {
    setNotice(null);
    startTransition(async () => {
      const result = await action();
      if (result.error) {
        setNotice({ tone: "error", text: result.error });
        return;
      }
      setNotice({ tone: "success", text: success });
      onRefresh();
      if (pageId) openPage(pageId);
    });
  };

  const createCapture = () => {
    const title = captureTitle.trim();
    if (!title) {
      setNotice({ tone: "error", text: "Capture title is required" });
      return;
    }

    setNotice(null);
    startTransition(async () => {
      const result = await createSecondBrainCaptureAction(orgId, projectId, {
        title,
        content:
          captureContent.trim() ||
          `Captured from Kanban UI on ${new Date().toISOString()}.`,
        parentId: inboxPage?.id,
      });

      if (result.error || !result.page) {
        setNotice({
          tone: "error",
          text: result.error ?? "Failed to create capture",
        });
        return;
      }

      setCaptureTitle("");
      setCaptureContent("");
      setIsCaptureOpen(false);
      setNotice({ tone: "success", text: "Capture saved" });
      onRefresh();
      openPage(result.page.id);
    });
  };

  return (
    <section className="border-b border-gray-200 bg-gray-50/80 p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
            Second Brain
          </h2>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
            <StatusPill label="Inbox" value={inboxCaptures.length} />
            <StatusPill label="Review" value={freshnessPages.length} />
          </div>
        </div>
        <button
          type="button"
          title="Create capture"
          onClick={() => setIsCaptureOpen((open) => !open)}
          className="h-8 w-8 rounded-md border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:opacity-50"
          disabled={isPending}
        >
          <PlusIcon />
        </button>
      </div>

      {notice && (
        <p
          className={`mt-2 rounded-md border px-2 py-1 text-[11px] ${
            notice.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}
        >
          {notice.text}
        </p>
      )}

      {isCaptureOpen && (
        <div className="mt-3 space-y-2">
          <input
            value={captureTitle}
            onChange={(event) => setCaptureTitle(event.target.value)}
            placeholder="Capture title"
            className="h-8 w-full rounded-md border border-gray-200 bg-white px-2 text-xs text-gray-900 outline-none focus:border-blue-400"
            disabled={isPending}
          />
          <textarea
            value={captureContent}
            onChange={(event) => setCaptureContent(event.target.value)}
            placeholder="Raw note"
            rows={3}
            className="w-full resize-none rounded-md border border-gray-200 bg-white px-2 py-1.5 text-xs text-gray-900 outline-none focus:border-blue-400"
            disabled={isPending}
          />
          <button
            type="button"
            onClick={createCapture}
            disabled={isPending}
            className="h-8 w-full rounded-md bg-gray-900 px-3 text-xs font-semibold text-white hover:bg-gray-800 disabled:opacity-50"
          >
            Save Capture
          </button>
        </div>
      )}

      {inboxCaptures.length > 0 && (
        <SecondBrainGroup title="Inbox">
          {inboxCaptures.slice(0, 4).map((page) => (
            <InboxCaptureRow
              key={page.id}
              page={page}
              disabled={isPending}
              onOpen={() => openPage(page.id)}
              onTask={() =>
                runAction(
                  () =>
                    createTriageTaskForWikiPageAction(
                      orgId,
                      projectId,
                      page.id,
                    ),
                  "Triage task created",
                  page.id,
                )
              }
              onDone={() =>
                runAction(
                  () => markWikiPageTriagedAction(orgId, projectId, page.id),
                  "Capture marked triaged",
                )
              }
            />
          ))}
        </SecondBrainGroup>
      )}

      {freshnessPages.length > 0 && (
        <SecondBrainGroup title="Review Due">
          {freshnessPages.slice(0, 4).map(({ page, reasons }) => (
            <FreshnessRow
              key={page.id}
              page={page}
              reasons={reasons}
              disabled={isPending}
              onOpen={() => openPage(page.id)}
              onTask={() =>
                runAction(
                  () =>
                    createFreshnessTaskForWikiPageAction(
                      orgId,
                      projectId,
                      page.id,
                    ),
                  "Freshness task created",
                  page.id,
                )
              }
            />
          ))}
        </SecondBrainGroup>
      )}
    </section>
  );
}

function SecondBrainGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3">
      <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
        {title}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function StatusPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="rounded-full border border-gray-200 bg-white px-2 py-0.5">
      {label} {value}
    </span>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="mx-auto h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}
