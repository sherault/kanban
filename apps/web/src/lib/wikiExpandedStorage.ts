const STORAGE_PREFIX = "kanban_wiki_expanded_";

function storageKey(orgId: string) {
  return `${STORAGE_PREFIX}${orgId}`;
}

/**
 * Returns the persisted expanded page ids for an organization, or null when
 * nothing has been stored yet (so callers can apply their default expansion).
 */
export function readWikiExpanded(orgId: string): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(storageKey(orgId));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return null;
  }
}

export function writeWikiExpanded(orgId: string, expandedIds: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(
      storageKey(orgId),
      JSON.stringify([...expandedIds]),
    );
  } catch {
    // Quota or privacy mode — expansion persistence is best effort.
  }
}
