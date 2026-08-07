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
  if (
    page.projectId !== null &&
    organizationIndexPageId != null &&
    page.parentId === organizationIndexPageId
  ) {
    return false;
  }
  return true;
}
