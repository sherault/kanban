"use client";

import {
  forwardRef,
  memo,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import { getTaskByIdAction } from "@/actions/tasks";
import {
  adjustCursorOffset,
  restoreSelection,
  saveSelection,
} from "./selection";
import { LinkTooltip } from "./LinkTooltip";
import type { VisualEditorProps, VisualEditorRef } from "./types";

const VisualEditorInner = forwardRef<VisualEditorRef, VisualEditorProps>(
  ({ initialHtml, onInputRef, pages, tasks }, ref) => {
    const divRef = useRef<HTMLDivElement>(null);
    const [tooltip, setTooltip] = useState<{
      href: string;
      rect: Partial<DOMRect>;
    } | null>(null);
    const [taskCache, setTaskCache] = useState<Record<string, string>>({});

    useEffect(() => {
      const el = divRef.current;
      if (!el) return;

      const handleClick = (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const anchor = target.closest("a");
        if (!anchor || !el.contains(anchor)) {
          setTooltip(null);
          return;
        }

        e.preventDefault();
        const href = anchor.getAttribute("href") || "";
        const rect = anchor.getBoundingClientRect();
        const parentRect = el.getBoundingClientRect();

        setTooltip({
          href,
          rect: {
            ...rect,
            left: rect.left - parentRect.left,
            top: rect.top - parentRect.top,
            bottom: rect.bottom - parentRect.top,
            right: rect.right - parentRect.left,
          } as DOMRect,
        });

        if (href.startsWith("task://")) {
          const id = href.replace("task://", "");
          const isKnown = tasks.some((t) => t.id === id) || taskCache[id];
          if (!isKnown) {
            void getTaskByIdAction(id).then((res) => {
              setTaskCache((prev) => ({
                ...prev,
                [id]: res.task ? res.task.title : `Unknown (${id.slice(0, 4)})`,
              }));
            });
          }
        }

        setTimeout(() => setTooltip(null), 2000);
      };

      el.addEventListener("click", handleClick);
      return () => el.removeEventListener("click", handleClick);
    }, [taskCache, tasks]);

    useImperativeHandle(ref, () => ({
      setHtml: (html: string) => {
        if (!divRef.current || divRef.current.innerHTML === html) return;

        const oldText = divRef.current.textContent || "";
        const savedSel = saveSelection(divRef.current);
        divRef.current.innerHTML = html;

        if (savedSel) {
          const newText = divRef.current.textContent || "";
          restoreSelection(divRef.current, {
            start: adjustCursorOffset(oldText, newText, savedSel.start),
            end: adjustCursorOffset(oldText, newText, savedSel.end),
          });
        }
      },
      getHtml: () => divRef.current?.innerHTML || "",
      getEl: () => divRef.current,
    }));

    return (
      <div className="relative w-full h-full min-h-0 flex flex-col">
        <div
          ref={divRef}
          contentEditable
          suppressContentEditableWarning
          onInput={(e) => onInputRef.current(e.currentTarget.innerHTML)}
          className="w-full h-full overflow-y-auto p-10 prose prose-slate max-w-none focus:outline-none prose-headings:font-black prose-headings:tracking-tighter prose-pre:bg-gray-900 prose-pre:rounded-xl"
          dangerouslySetInnerHTML={{ __html: initialHtml }}
        />
        {tooltip && (
          <LinkTooltip
            href={tooltip.href}
            rect={tooltip.rect}
            pages={pages}
            tasks={tasks}
            taskCache={taskCache}
          />
        )}
      </div>
    );
  },
);

VisualEditorInner.displayName = "VisualEditor";

export const VisualEditor = memo(VisualEditorInner, () => true);
