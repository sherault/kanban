"use client";

import { useState } from "react";
import type { Dispatch, KeyboardEvent, SetStateAction } from "react";

interface NewTaskTagsFieldProps {
  allTags: string[];
  tags: string[];
  setTags: Dispatch<SetStateAction<string[]>>;
}

export function NewTaskTagsField({
  allTags,
  tags,
  setTags,
}: NewTaskTagsFieldProps) {
  const [tagInput, setTagInput] = useState("");

  function handleTagKey(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === "Enter" || event.key === ",") && tagInput.trim()) {
      event.preventDefault();
      addTag(tagInput);
    }
  }

  function addTag(value: string) {
    const tag = value.trim().toLowerCase();
    if (tag && !tags.includes(tag)) {
      setTags((prev) => [...prev, tag]);
    }
    setTagInput("");
  }

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Tags
      </label>
      {tags.map((tag) => (
        <input key={tag} type="hidden" name="tags" value={tag} />
      ))}
      <div className="flex flex-wrap gap-1 border border-gray-300 rounded-md px-3 py-2 min-h-[40px] focus-within:ring-2 focus-within:ring-blue-500">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded"
          >
            {tag}
            <button
              type="button"
              onClick={() => setTags((prev) => prev.filter((x) => x !== tag))}
              className="text-gray-400 hover:text-gray-600"
            >
              &times;
            </button>
          </span>
        ))}
        <input
          list="new-task-tags"
          value={tagInput}
          onChange={(event) => {
            const value = event.target.value;
            const normalized = value.trim().toLowerCase();
            if (allTags.includes(normalized) && !tags.includes(normalized)) {
              addTag(normalized);
            } else {
              setTagInput(value);
            }
          }}
          onKeyDown={handleTagKey}
          placeholder={tags.length === 0 ? "Add tag, press Enter..." : ""}
          className="flex-1 min-w-[120px] text-sm outline-none bg-transparent"
        />
        <datalist id="new-task-tags">
          {allTags
            .filter((tag) => !tags.includes(tag))
            .map((tag) => (
              <option key={tag} value={tag} />
            ))}
        </datalist>
      </div>
    </div>
  );
}
