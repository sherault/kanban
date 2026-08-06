"use client";

export const SECOND_BRAIN_COLLAPSED_KEY = "kanban_second_brain_collapsed";

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  inboxCount: number;
  reviewCount: number;
  onCapture: () => void;
  captureDisabled: boolean;
}

export function SecondBrainHeader({
  collapsed,
  onToggle,
  inboxCount,
  reviewCount,
  onCapture,
  captureDisabled,
}: Props) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={!collapsed}
        title={collapsed ? "Expand Second Brain" : "Collapse Second Brain"}
        className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1 py-1 text-left hover:bg-gray-100"
      >
        <ChevronIcon collapsed={collapsed} />
        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
          Second Brain
        </span>
        {inboxCount > 0 && <CountBadge label="Inbox" value={inboxCount} />}
        {reviewCount > 0 && <CountBadge label="Review" value={reviewCount} />}
      </button>
      <button
        type="button"
        title="Create capture"
        onClick={onCapture}
        disabled={captureDisabled}
        className="h-8 w-8 shrink-0 rounded-md border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900 disabled:opacity-50"
      >
        <PlusIcon />
      </button>
    </div>
  );
}

function CountBadge({ label, value }: { label: string; value: number }) {
  return (
    <span className="shrink-0 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[10px] text-gray-500">
      {label} {value}
    </span>
  );
}

function ChevronIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className={`h-3 w-3 shrink-0 text-gray-400 transition-transform ${
        collapsed ? "" : "rotate-90"
      }`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M7 5l6 5-6 5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 20 20"
      className="mx-auto h-4 w-4"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path d="M10 4v12M4 10h12" strokeLinecap="round" />
    </svg>
  );
}
