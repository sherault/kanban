import type { WikiPageSummaryDto } from "@kanban/shared";

export function WikiResults({
  pages,
  search,
  onSelect,
}: {
  pages: WikiPageSummaryDto[];
  search: string;
  onSelect: (href: string, title?: string) => void;
}) {
  const filteredPages = pages.filter(
    (p) =>
      p.title.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <>
      {filteredPages.map((p) => (
        <button
          key={p.id}
          onClick={() => onSelect(`wiki:${p.id}`, p.title)}
          className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-blue-50 group transition-all"
        >
          <div className="font-medium text-sm text-gray-900 group-hover:text-blue-700">
            {p.title}
          </div>
          <div className="text-[10px] text-gray-500 font-mono mt-0.5">
            {p.slug}
          </div>
        </button>
      ))}

      {filteredPages.length === 0 && (
        <div className="py-8 text-center text-gray-400 text-xs">
          {search ? "No pages found" : "No wiki pages yet"}
        </div>
      )}
    </>
  );
}
