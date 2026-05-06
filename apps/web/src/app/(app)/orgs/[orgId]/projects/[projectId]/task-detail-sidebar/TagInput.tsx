import { useId, useState } from "react";
import type { KeyboardEvent } from "react";

export function TagInput({
  tags,
  allTags,
  onAdd,
  onRemove,
}: {
  tags: string[];
  allTags: string[];
  onAdd: (tag: string) => void;
  onRemove: (tag: string) => void;
}) {
  const [input, setInput] = useState("");
  const listId = useId();
  const suggestions = allTags.filter((tag) => !(tags || []).includes(tag));

  function handleKey(e: KeyboardEvent<HTMLInputElement>) {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      onAdd(input.trim().toLowerCase());
      setInput("");
    }
  }

  return (
    <div className="flex flex-wrap gap-1 border border-gray-200 rounded px-2 py-1.5 min-h-[36px] focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-400">
      {(tags || []).map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded"
        >
          {tag}
          <button
            onClick={() => onRemove(tag)}
            className="text-gray-400 hover:text-gray-600 leading-none"
          >
            &times;
          </button>
        </span>
      ))}
      <input
        list={listId}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKey}
        placeholder={(tags?.length || 0) === 0 ? "Add tag, press Enter…" : ""}
        className="flex-1 min-w-[80px] text-xs outline-none bg-transparent"
      />
      <datalist id={listId}>
        {suggestions.map((tag) => (
          <option key={tag} value={tag} />
        ))}
      </datalist>
    </div>
  );
}
