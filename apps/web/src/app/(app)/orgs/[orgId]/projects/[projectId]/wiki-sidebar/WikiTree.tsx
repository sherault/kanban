import {
  ORGANIZATION_INDEX_SLUG,
  isWikiPageDeletable,
  isWikiPageMovable,
  isWikiPageRenamable,
  type WikiPageSummaryDto,
} from "@kanban/shared";
import { WikiTreeItem } from "./WikiTreeItem";

interface WikiTreeProps {
  pages: WikiPageSummaryDto[];
  orgId: string;
  projectId: string;
  expandedIds: Set<string>;
  onToggle: (pageId: string) => void;
  onRefresh: () => void;
}

export function WikiTree({
  pages,
  orgId,
  projectId,
  expandedIds,
  onToggle,
  onRefresh,
}: WikiTreeProps) {
  const indexPageId =
    pages.find((page) => page.slug === ORGANIZATION_INDEX_SLUG)?.id ?? null;

  // Deleting a page cascades over its subtree, so the confirm dialog needs the
  // full descendant set, not just the direct children.
  const descendantIdsOf = (pageId: string): string[] => {
    const children = pages.filter((candidate) => candidate.parentId === pageId);
    return children.flatMap((child) => [
      child.id,
      ...descendantIdsOf(child.id),
    ]);
  };

  const renderItem = (page: WikiPageSummaryDto) => {
    const hasChildren = pages.some(
      (candidate) => candidate.parentId === page.id,
    );
    const isExpanded = expandedIds.has(page.id);

    return (
      <div key={page.id} className="mt-1">
        <WikiTreeItem
          page={page}
          orgId={orgId}
          projectId={projectId}
          hasChildren={hasChildren}
          isExpanded={isExpanded}
          isRenamable={isWikiPageRenamable(page, indexPageId)}
          isDeletable={isWikiPageDeletable(page, indexPageId)}
          isMovable={isWikiPageMovable(page, indexPageId)}
          descendantIds={descendantIdsOf(page.id)}
          onToggle={() => onToggle(page.id)}
          onRenamed={onRefresh}
          onDeleted={onRefresh}
        />
        {isExpanded && (
          <div className="ml-3 border-l border-gray-100 pl-1">
            {pages
              .filter((candidate) => candidate.parentId === page.id)
              .map(renderItem)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-1">
      {pages
        .filter((page) => page.parentId === null)
        .map((page) => renderItem(page))}
    </div>
  );
}
