import type { WikiPageSummaryDto } from "@kanban/shared";

export function isCaptureInboxPage(page: WikiPageSummaryDto) {
  return (
    stringProperty(page.properties?.["doc_type"]) === "capture_inbox" ||
    page.title.toLowerCase() === "second brain inbox"
  );
}

export function isInboxCapture(page: WikiPageSummaryDto) {
  const properties = page.properties ?? {};
  return (
    stringProperty(properties["doc_type"]) === "capture" &&
    stringProperty(properties["status"], "inbox") === "inbox"
  );
}

export function freshnessReasons(page: WikiPageSummaryDto) {
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

export function stringProperty(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

export function arrayProperty(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

export function objectProperty(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
