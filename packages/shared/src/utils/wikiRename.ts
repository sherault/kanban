export const ORGANIZATION_INDEX_SLUG = "root";

export type RenameGuardPage = {
  slug: string;
  projectId: string | null;
  parentId: string | null;
};

/**
 * The organization index and the project knowledge bases hanging under it are
 * generated and kept in sync by the API, so their titles are not user-editable.
 */
export function isWikiPageRenamable(
  page: RenameGuardPage,
  organizationIndexPageId: string | null | undefined,
): boolean {
  if (page.slug === ORGANIZATION_INDEX_SLUG) return false;
  if (isProjectKnowledgeBase(page, organizationIndexPageId)) return false;
  return true;
}

/**
 * Same guard as renaming: the index page owns the whole wiki tree and project
 * knowledge bases are owned by their project lifecycle, not by the user.
 */
export function isWikiPageDeletable(
  page: RenameGuardPage,
  organizationIndexPageId: string | null | undefined,
): boolean {
  if (page.slug === ORGANIZATION_INDEX_SLUG) return false;
  if (isProjectKnowledgeBase(page, organizationIndexPageId)) return false;
  return true;
}

/**
 * Same guard again: the index page is the wiki root and project knowledge bases
 * must stay directly under it, so neither can be reparented.
 */
export function isWikiPageMovable(
  page: RenameGuardPage,
  organizationIndexPageId: string | null | undefined,
): boolean {
  if (page.slug === ORGANIZATION_INDEX_SLUG) return false;
  if (isProjectKnowledgeBase(page, organizationIndexPageId)) return false;
  return true;
}

function isProjectKnowledgeBase(
  page: RenameGuardPage,
  organizationIndexPageId: string | null | undefined,
): boolean {
  return (
    page.projectId !== null &&
    organizationIndexPageId != null &&
    page.parentId === organizationIndexPageId
  );
}
