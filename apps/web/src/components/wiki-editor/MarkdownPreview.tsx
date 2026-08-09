import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { WikiPageSummaryDto } from "@kanban/shared";
import { MarkdownLink } from "./MarkdownLink";

export function MarkdownPreview({
  content,
  emptyText,
  orgId,
  pages,
}: {
  content: string;
  emptyText: string;
  orgId: string;
  pages: WikiPageSummaryDto[];
}) {
  return (
    <div className="flex-1 h-full overflow-y-auto bg-white p-10 prose prose-slate max-w-none prose-headings:font-black prose-headings:tracking-tighter prose-pre:bg-gray-900 prose-pre:rounded-xl">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={(url) => url}
        components={{
          a: ({ href, children }) => (
            <MarkdownLink href={href} currentOrgId={orgId} pages={pages}>
              {children}
            </MarkdownLink>
          ),
        }}
      >
        {content || emptyText}
      </ReactMarkdown>
    </div>
  );
}
