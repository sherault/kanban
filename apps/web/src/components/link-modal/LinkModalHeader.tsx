export function LinkModalHeader({ type }: { type: "link" | "wiki" | "task" }) {
  return (
    <div className="p-6 border-b border-gray-100 bg-gray-50/30">
      <h3 className="text-lg font-bold text-gray-900 tracking-tight">
        {type === "link"
          ? "Insert Link"
          : type === "wiki"
            ? "Link to Wiki Page"
            : "Link to Task"}
      </h3>
      <p className="text-xs text-gray-500 mt-1">
        {type === "link"
          ? "Enter a URL to link to external content."
          : "Search and select an internal item to link."}
      </p>
    </div>
  );
}
