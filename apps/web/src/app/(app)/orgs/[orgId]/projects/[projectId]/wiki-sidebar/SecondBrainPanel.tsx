"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { WikiPageSummaryDto } from "@kanban/shared";
import {
  createFreshnessTaskForWikiPageAction,
  createSecondBrainCaptureAction,
  createTriageTaskForWikiPageAction,
  markWikiPageTriagedAction,
} from "@/actions/wiki";

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

  const scopedPages = useMemo(
    () =>
      pages.filter(
        (page) => page.projectId === null || page.projectId === projectId,
      ),
    [pages, projectId],
  );
  const inboxPage = scopedPages.find(isCaptureInboxPage);
  const inboxCaptures = scopedPages.filter(isInboxCapture);
  const freshnessPages = scopedPages
    .map((page) => ({ page, reasons: freshnessReasons(page) }))
    .filter((item) => !isInboxCapture(item.page) && item.reasons.length > 0);

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

function InboxCaptureRow({
  page,
  disabled,
  onOpen,
  onTask,
  onDone,
}: {
  page: WikiPageSummaryDto;
  disabled: boolean;
  onOpen: () => void;
  onTask: () => void;
  onDone: () => void;
}) {
  const hasTask =
    arrayProperty(page.properties?.["related_task_ids"]).length > 0;

  return (
    <div className="rounded-md border border-gray-200 bg-white p-2">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full truncate text-left text-xs font-medium text-gray-800 hover:text-blue-700"
      >
        {page.title}
      </button>
      <div className="mt-2 flex items-center gap-1">
        <MiniButton title="Open page" onClick={onOpen} disabled={disabled}>
          Open
        </MiniButton>
        <MiniButton
          title={hasTask ? "Triage task already linked" : "Create triage task"}
          onClick={onTask}
          disabled={disabled || hasTask}
        >
          Task
        </MiniButton>
        <MiniButton title="Mark triaged" onClick={onDone} disabled={disabled}>
          Done
        </MiniButton>
      </div>
    </div>
  );
}

function FreshnessRow({
  page,
  reasons,
  disabled,
  onOpen,
  onTask,
}: {
  page: WikiPageSummaryDto;
  reasons: string[];
  disabled: boolean;
  onOpen: () => void;
  onTask: () => void;
}) {
  const freshness = objectProperty(page.properties?.["freshness"]);
  const hasReviewTask = typeof freshness["review_task_id"] === "string";

  return (
    <div className="rounded-md border border-gray-200 bg-white p-2">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full truncate text-left text-xs font-medium text-gray-800 hover:text-blue-700"
      >
        {page.title}
      </button>
      <div className="mt-1 truncate text-[10px] text-gray-500">
        {reasons.join(", ")}
      </div>
      <div className="mt-2 flex items-center gap-1">
        <MiniButton title="Open page" onClick={onOpen} disabled={disabled}>
          Open
        </MiniButton>
        <MiniButton
          title={
            hasReviewTask
              ? "Freshness task already linked"
              : "Create review task"
          }
          onClick={onTask}
          disabled={disabled || hasReviewTask}
        >
          Review
        </MiniButton>
      </div>
    </div>
  );
}

function MiniButton({
  title,
  onClick,
  disabled,
  children,
}: {
  title: string;
  onClick: () => void;
  disabled: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      disabled={disabled}
      className="h-6 rounded border border-gray-200 px-2 text-[11px] font-medium text-gray-600 hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
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

function isCaptureInboxPage(page: WikiPageSummaryDto) {
  return (
    stringProperty(page.properties?.["doc_type"]) === "capture_inbox" ||
    page.title.toLowerCase() === "second brain inbox"
  );
}

function isInboxCapture(page: WikiPageSummaryDto) {
  const properties = page.properties ?? {};
  return (
    stringProperty(properties["doc_type"]) === "capture" &&
    stringProperty(properties["status"], "inbox") === "inbox"
  );
}

function freshnessReasons(page: WikiPageSummaryDto) {
  const properties = page.properties ?? {};
  const freshness = objectProperty(properties["freshness"]);
  const reasons = new Set<string>();

  if (isDueDate(stringProperty(properties["review_after"]))) {
    reasons.add("review_after");
  }
  if (
    isDueDate(stringProperty(freshness["review_after"])) ||
    isDueDate(stringProperty(freshness["next_review"]))
  ) {
    reasons.add("freshness");
  }
  if (isDueDate(stringProperty(properties["effective_to"]))) {
    reasons.add("expired");
  }
  if (
    properties["cite_required"] === true &&
    arrayProperty(properties["source_urls"]).length === 0
  ) {
    reasons.add("sources");
  }
  if (
    ["draft", "needs_validation", "unvalidated"].includes(
      stringProperty(properties["validation_status"]),
    )
  ) {
    reasons.add("validation");
  }
  if (["stale", "expired"].includes(stringProperty(freshness["status"]))) {
    reasons.add(stringProperty(freshness["status"]));
  }

  return [...reasons];
}

function isDueDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && value <= todayString();
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function stringProperty(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function arrayProperty(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function objectProperty(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
