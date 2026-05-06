"use client";

import type { RefObject, ReactNode } from "react";
import { applyToolbar, TOOLBAR } from "./toolbarConfig";

export function DescriptionToolbar({
  textareaRef,
  onChange,
  showPreview,
  onTogglePreview,
  onLink,
  extra,
}: {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
  showPreview: boolean;
  onTogglePreview: () => void;
  onLink: (type: "link" | "wiki" | "task") => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-gray-200 bg-gray-50 px-2 py-1 shrink-0">
      {TOOLBAR.map((item, i) =>
        item.type === "divider" ? (
          <div key={i} className="w-px h-3.5 bg-gray-300 mx-0.5" />
        ) : (
          <button
            key={item.title}
            type="button"
            title={item.title}
            onMouseDown={(e) => {
              e.preventDefault();
              if (item.title === "Wiki Link") {
                onLink("wiki");
              } else if (item.title === "Task Link") {
                onLink("task");
              } else if (item.title === "External Link") {
                onLink("link");
              } else if (textareaRef.current) {
                onChange(applyToolbar(textareaRef.current, item));
              }
            }}
            className="px-1.5 py-0.5 text-xs rounded hover:bg-gray-200 text-gray-600 font-mono leading-none"
          >
            {item.icon}
          </button>
        ),
      )}
      <div className="flex-1" />
      <button
        type="button"
        onClick={onTogglePreview}
        className={`px-2 py-0.5 text-xs rounded ${
          showPreview
            ? "bg-blue-100 text-blue-700 font-medium"
            : "hover:bg-gray-200 text-gray-500"
        }`}
      >
        Preview
      </button>
      {extra}
    </div>
  );
}
