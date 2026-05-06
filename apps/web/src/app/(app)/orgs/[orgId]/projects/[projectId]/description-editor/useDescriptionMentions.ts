import { useEffect, useMemo, useState } from "react";
import type { KeyboardEvent, RefObject } from "react";
import { searchTasksInOrgAction } from "@/actions/tasks";
import type { TaskDto, WikiPageSummaryDto } from "@kanban/shared";

type MentionItem = TaskDto | WikiPageSummaryDto;

export function useDescriptionMentions({
  orgId,
  pages,
  textareaRef,
  onChange,
}: {
  orgId: string;
  pages: WikiPageSummaryDto[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}) {
  const [mentionSearch, setMentionSearch] = useState<string | null>(null);
  const [mentionType, setMentionType] = useState<"task" | "wiki">("task");
  const [mentionResults, setMentionResults] = useState<MentionItem[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [mentionCoords, setMentionCoords] = useState({ top: 0, left: 0 });

  const wikiMentionResults = useMemo(() => {
    if (mentionSearch === null || mentionType !== "wiki") return [];
    return pages
      .filter((p) =>
        p.title.toLowerCase().includes(mentionSearch.toLowerCase()),
      )
      .slice(0, 8);
  }, [mentionSearch, mentionType, pages]);

  useEffect(() => {
    if (mentionSearch === null) return;

    if (mentionType === "task") {
      const timer = setTimeout(async () => {
        const res = await searchTasksInOrgAction(orgId, mentionSearch);
        if (res.tasks) {
          setMentionResults(res.tasks.slice(0, 8));
          setMentionIndex(0);
        }
      }, 200);
      return () => clearTimeout(timer);
    }

    void Promise.resolve().then(() => setMentionIndex(0));
  }, [mentionSearch, mentionType, orgId]);

  const activeResults =
    mentionSearch === null
      ? []
      : mentionType === "task"
        ? mentionResults
        : wikiMentionResults;

  function insertMention(item: MentionItem) {
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const start = textarea.selectionStart;
    const text = textarea.value;

    const isTask = mentionType === "task";
    const triggerPos = isTask
      ? text.lastIndexOf("@", start - 1)
      : text.lastIndexOf("[[", start - 1);
    const mention = isTask
      ? `[#${item.title}](task:${item.id})`
      : `[${item.title}](wiki:${item.id})`;

    if (triggerPos === -1) return;

    const newVal =
      text.slice(0, triggerPos) + mention + " " + text.slice(start);
    onChange(newVal);
    setMentionSearch(null);

    const newPos = triggerPos + mention.length + 1;
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(newPos, newPos);
    }, 0);
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (mentionSearch === null || activeResults.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setMentionIndex((i) => (i + 1) % activeResults.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setMentionIndex(
        (i) => (i - 1 + activeResults.length) % activeResults.length,
      );
    } else if (e.key === "Enter" || e.key === "Tab") {
      e.preventDefault();
      insertMention(activeResults[mentionIndex]);
    } else if (e.key === "Escape") {
      setMentionSearch(null);
    }
  }

  function handleTextareaChange(val: string) {
    onChange(val);
    if (!textareaRef.current) return;
    const textarea = textareaRef.current;
    const pos = textarea.selectionStart;
    const text = val.slice(0, pos);
    const rect = textarea.getBoundingClientRect();

    const lastAt = text.lastIndexOf("@");
    if (lastAt !== -1 && !text.slice(lastAt).includes(" ")) {
      setMentionSearch(text.slice(lastAt + 1));
      setMentionType("task");
      setMentionCoords({ top: rect.top + 20, left: rect.left + 20 });
      return;
    }

    const lastBracket = text.lastIndexOf("[[");
    if (
      lastBracket !== -1 &&
      !text.slice(lastBracket).includes(" ") &&
      !text.slice(lastBracket).includes("\n")
    ) {
      setMentionSearch(text.slice(lastBracket + 2));
      setMentionType("wiki");
      setMentionCoords({ top: rect.top + 20, left: rect.left + 20 });
      return;
    }

    setMentionSearch(null);
  }

  return {
    mentionSearch,
    mentionType,
    mentionIndex,
    mentionCoords,
    activeResults,
    setMentionSearch,
    insertMention,
    handleKeyDown,
    handleTextareaChange,
  };
}
