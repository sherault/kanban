const STORAGE_PREFIX = "kanban_active_project_";

function storageKey(orgId: string) {
  return `${STORAGE_PREFIX}${orgId}`;
}

/**
 * The org's active project, per browser tab. Backs the Board tab target while
 * the user is in the org-level wiki, and the Second Brain project selector.
 * Read it from event handlers or effects only — never during render, or the
 * server and client markup disagree.
 */
export function readActiveProject(orgId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const value = window.sessionStorage.getItem(storageKey(orgId));
    return value && value.length > 0 ? value : null;
  } catch {
    return null;
  }
}

export function writeActiveProject(orgId: string, projectId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey(orgId), projectId);
  } catch {
    // Quota or privacy mode — the Board tab just falls back to the org page.
  }
}

export function clearActiveProject(orgId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(storageKey(orgId));
  } catch {
    // Quota or privacy mode — nothing to clean up.
  }
}
