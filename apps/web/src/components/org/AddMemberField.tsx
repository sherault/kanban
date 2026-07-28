"use client";

import { useEffect, useRef, useState } from "react";
import {
  MIN_MEMBER_SEARCH_LENGTH,
  type MemberCandidateDto,
} from "@kanban/shared";
import { addMemberAction, searchMemberCandidatesAction } from "@/actions/orgs";

const DEBOUNCE_MS = 250;

interface Results {
  query: string;
  items: MemberCandidateDto[];
}

interface Props {
  orgId: string;
  onMemberAdded: () => void;
}

export function AddMemberField({ orgId, onMemberAdded }: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Results>({ query: "", items: [] });
  const [isFocused, setIsFocused] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Guards against a slow response for an earlier query overwriting a newer one.
  const latestQuery = useRef("");

  const trimmed = query.trim();
  const tooShort = trimmed.length < MIN_MEMBER_SEARCH_LENGTH;
  const isSearching = !tooShort && results.query !== trimmed;
  const candidates = isSearching ? [] : results.items;
  const showDropdown = isFocused && !isDismissed && !tooShort;

  useEffect(() => {
    if (!isSearching) return;
    latestQuery.current = trimmed;

    const timer = setTimeout(async () => {
      const result = await searchMemberCandidatesAction(orgId, trimmed);
      if (latestQuery.current !== trimmed) return;
      setResults({ query: trimmed, items: result.candidates });
      setError(result.error ?? null);
      setHighlighted(0);
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [orgId, trimmed, isSearching]);

  async function add(candidate: MemberCandidateDto) {
    setAddingId(candidate.id);
    setError(null);
    const result = await addMemberAction(orgId, candidate.id);
    setAddingId(null);
    if (result.error) {
      setError(result.error);
      return;
    }
    latestQuery.current = "";
    setQuery("");
    setResults({ query: "", items: [] });
    onMemberAdded();
  }

  const highlightIndex = Math.min(highlighted, candidates.length - 1);

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setIsDismissed(true);
      return;
    }
    if (!showDropdown || candidates.length === 0) return;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlighted((i) => (i + 1) % candidates.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((i) => (i - 1 + candidates.length) % candidates.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const candidate = candidates[highlightIndex];
      if (candidate) void add(candidate);
    }
  }

  return (
    <div className="relative">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setIsDismissed(false);
        }}
        onKeyDown={onKeyDown}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setTimeout(() => setIsFocused(false), 150)}
        placeholder="Search by email…"
        autoComplete="off"
        disabled={addingId !== null}
        className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50"
      />

      {showDropdown && (
        <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-56 overflow-y-auto">
          {isSearching ? (
            <p className="px-3 py-2 text-sm text-gray-400">Searching…</p>
          ) : candidates.length === 0 ? (
            <p className="px-3 py-2 text-sm text-gray-400">No matching users</p>
          ) : (
            candidates.map((candidate, i) => (
              <button
                key={candidate.id}
                type="button"
                onMouseEnter={() => setHighlighted(i)}
                onClick={() => void add(candidate)}
                disabled={addingId !== null}
                className={`w-full text-left px-3 py-2 disabled:opacity-50 ${
                  i === highlightIndex ? "bg-blue-50" : "hover:bg-gray-50"
                }`}
              >
                <span className="block text-sm text-gray-900 truncate">
                  {candidate.displayName}
                </span>
                <span className="block text-xs text-gray-400 truncate">
                  {candidate.email}
                </span>
              </button>
            ))
          )}
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
