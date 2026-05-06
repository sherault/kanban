export function CreateWikiPageButton() {
  return (
    <div className="flex-none p-3 border-t border-gray-100 bg-gray-50/30">
      <button
        onClick={() =>
          window.dispatchEvent(new CustomEvent("kanban_create_wiki_page"))
        }
        className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-semibold text-blue-600 bg-blue-50 hover:bg-blue-100 transition-all border border-blue-100 shadow-sm"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4v16m8-8H4"
          />
        </svg>
        Create New Page
      </button>
    </div>
  );
}
