"use client";

import { useMemo } from "react";
import type { WikiPageSummaryDto } from "@kanban/shared";
import {
  freshnessReasons,
  isCaptureInboxPage,
  isInboxCapture,
} from "./helpers";

export function useSecondBrainData(
  pages: WikiPageSummaryDto[],
  projectId: string,
) {
  return useMemo(() => {
    const scopedPages = pages.filter(
      (page) => page.projectId === null || page.projectId === projectId,
    );
    const inboxPage = scopedPages.find(isCaptureInboxPage);
    const inboxCaptures = scopedPages.filter(isInboxCapture);
    const freshnessPages = scopedPages
      .map((page) => ({ page, reasons: freshnessReasons(page) }))
      .filter((item) => !isInboxCapture(item.page) && item.reasons.length > 0);

    return {
      inboxPage,
      inboxCaptures,
      freshnessPages,
      inboxCount: inboxCaptures.length,
      reviewCount: freshnessPages.length,
    };
  }, [pages, projectId]);
}
