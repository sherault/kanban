export interface StoredWikiTabs {
  splits: Array<{ activePageId: string | null; openPageIds: string[] }>;
  isSplit: boolean;
  activeSplitIndex: number;
}

const STORAGE_PREFIX = "kanban_wiki_tabs_";

function storageKey(orgId: string) {
  return `${STORAGE_PREFIX}${orgId}`;
}

function isValidSplit(
  value: unknown,
): value is StoredWikiTabs["splits"][number] {
  if (typeof value !== "object" || value === null) return false;
  const split = value as Record<string, unknown>;
  const activeOk =
    split.activePageId === null || typeof split.activePageId === "string";
  const openOk =
    Array.isArray(split.openPageIds) &&
    split.openPageIds.every((id) => typeof id === "string");
  return activeOk && openOk;
}

export function readWikiTabs(orgId: string): StoredWikiTabs | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(storageKey(orgId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    const { splits, isSplit, activeSplitIndex } = parsed as Record<
      string,
      unknown
    >;
    if (!Array.isArray(splits) || splits.length === 0 || splits.length > 2) {
      return null;
    }
    if (!splits.every(isValidSplit)) return null;

    const normalizedIsSplit = isSplit === true && splits.length === 2;
    const trimmedSplits = normalizedIsSplit ? splits : splits.slice(0, 1);
    const index =
      typeof activeSplitIndex === "number" &&
      activeSplitIndex >= 0 &&
      activeSplitIndex < trimmedSplits.length
        ? activeSplitIndex
        : 0;

    return {
      splits: trimmedSplits,
      isSplit: normalizedIsSplit,
      activeSplitIndex: index,
    };
  } catch {
    return null;
  }
}

export function writeWikiTabs(orgId: string, value: StoredWikiTabs) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(orgId), JSON.stringify(value));
  } catch {
    // Quota or privacy mode — tab persistence is best effort.
  }
}
