import type { WikiPageSummaryDto } from "@kanban/shared";
import { WikiTreeItem } from "./WikiTreeItem";

interface WikiTreeProps {
  pages: WikiPageSummaryDto[];
  orgId: string;
  projectId: string;
  expandedIds: Set<string>;
  onToggle: (pageId: string) => void;
}

export function WikiTree({
  pages,
  orgId,
  projectId,
  expandedIds,
  onToggle,
}: WikiTreeProps) {
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
          onToggle={() => onToggle(page.id)}
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
