"use client";

import { useEffect, useState } from "react";

const SHORT_ID_LENGTH = 6;
const COPIED_FEEDBACK_MS = 1500;

export function TaskIdCopy({ taskId }: { taskId: string }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        void navigator.clipboard.writeText(taskId).then(() => setCopied(true));
      }}
      onPointerDown={(event) => event.stopPropagation()}
      title={copied ? "Copied!" : `Copy task id ${taskId}`}
      className={`inline-flex items-center gap-1 text-[10px] font-mono rounded px-1 -mx-1 transition-colors ${
        copied
          ? "text-green-600"
          : "text-gray-300 hover:text-gray-600 hover:bg-gray-100"
      }`}
    >
      #{taskId.slice(0, SHORT_ID_LENGTH)}
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}

function CopyIcon() {
  return (
    <svg
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      className="w-3 h-3"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}
